import { useEffect, useRef, useState, type WheelEvent } from "react";
import { listen } from "@tauri-apps/api/event";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import "./styles.css";
import { AboutDialog } from "./components/AboutDialog";
import { BrightnessSlider } from "./components/BrightnessSlider";
import { DeviceNav } from "./components/DeviceNav";
import { SettingsDialog } from "./components/SettingsDialog";
import { StartupInfoDialog } from "./components/StartupInfoDialog";
import { StatusBar } from "./components/StatusBar";
import { TitleBar } from "./components/TitleBar";
import {
  mapAutostartError,
  mapHotkeyRegistrationError,
  mapHotkeyValidationError,
  mapQuitError,
} from "./errors";
import { loadHotkeys, saveHotkeys, validateHotkeys } from "./hotkeys";
import { useDisplays } from "./hooks/useDisplays";
import { useHotkeys } from "./hooks/useHotkeys";
import { useStartupOverlay } from "./hooks/useStartupOverlay";
import { useWindowPosition } from "./hooks/useWindowPosition";
import { quit } from "./services/tauriApi";
import { HOTKEYS, SLIDER, type HotkeyConfig, type HotkeyDirection } from "./types";

export type { DisplayInfo } from "./types";

const NOTICE_AUTO_DISMISS_MS = 5000;

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [hotkeys, setHotkeys] = useState<HotkeyConfig>(() => loadHotkeys());
  const isDraggingRef = useRef(false);
  const sliderDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { showWindow, hideWindow, handleTitleBarMouseDown } = useWindowPosition();
  const { showStartupInfo, startStartupOverlay, closeStartupOverlay } =
    useStartupOverlay();
  const {
    displays,
    selectedIndex,
    selectDisplay,
    currentPercentage,
    currentPercentageRef,
    hdrActive,
    loading,
    isRefreshing,
    error,
    notice,
    setNotice,
    loadDisplays,
    refreshDisplays,
    previewPercentage,
    applyBrightness,
  } = useDisplays({
    showWindow,
    startStartupOverlay,
  });

  useHotkeys({
    currentPercentageRef,
    applyBrightness,
    hotkeys,
    onRegistrationError: () => setNotice(mapHotkeyRegistrationError()),
  });

  useEffect(() => {
    loadDisplays();

    isEnabled().then(setAutostartEnabled).catch((err) => {
      console.warn("Failed to get autostart status:", err);
    });

    const unlistenShowWindow = listen("show-window", async () => {
      await showWindow();
      await refreshDisplays({ silent: true });
    });

    const unlistenSelectDisplay = listen<number>("select-display", (event) => {
      selectDisplay(event.payload);
    });

    return () => {
      unlistenShowWindow.then((fn) => fn());
      unlistenSelectDisplay.then((fn) => fn());
    };
  }, [loadDisplays, refreshDisplays, selectDisplay, showWindow]);

  useEffect(() => {
    return () => {
      if (sliderDebounceRef.current !== null) {
        clearTimeout(sliderDebounceRef.current);
      }

      if (wheelDebounceRef.current !== null) {
        clearTimeout(wheelDebounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setNotice(null);
    }, NOTICE_AUTO_DISMISS_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [notice, setNotice]);

  const handleToggleAutostart = async () => {
    try {
      if (autostartEnabled) {
        await disable();
        setAutostartEnabled(false);
      } else {
        await enable();
        setAutostartEnabled(true);
      }
      setNotice(null);
    } catch (err) {
      console.error("Failed to toggle autostart:", err);
      setNotice(mapAutostartError());
    }
  };

  const handleQuit = async () => {
    try {
      await quit();
    } catch (err) {
      console.error("Failed to quit:", err);
      setNotice(mapQuitError());
    }
  };

  const handleHotkeyChange = (direction: HotkeyDirection, value: string) => {
    const nextHotkeys = {
      ...hotkeys,
      [direction]: value,
    };

    const validationError = validateHotkeys(nextHotkeys);
    if (validationError) {
      setNotice(mapHotkeyValidationError(validationError));
      return false;
    }

    setHotkeys(nextHotkeys);
    saveHotkeys(nextHotkeys);
    setNotice(null);
    return true;
  };

  const handleHotkeyReset = () => {
    const defaultHotkeys: HotkeyConfig = {
      increase: HOTKEYS.increase,
      decrease: HOTKEYS.decrease,
    };

    setHotkeys(defaultHotkeys);
    saveHotkeys(defaultHotkeys);
    setNotice(null);
  };

  const handleSliderChange = (percentage: number, element: HTMLInputElement) => {
    previewPercentage(percentage);
    element.style.setProperty("--progress", `${percentage}%`);

    if (sliderDebounceRef.current !== null) {
      clearTimeout(sliderDebounceRef.current);
    }

    sliderDebounceRef.current = setTimeout(async () => {
      if (isDraggingRef.current) {
        try {
          await applyBrightness(percentage);
        } catch {
        }
      }
    }, 50);
  };

  const handleSliderDown = () => {
    if (sliderDebounceRef.current !== null) {
      clearTimeout(sliderDebounceRef.current);
      sliderDebounceRef.current = null;
    }
    isDraggingRef.current = true;
  };

  const handleSliderCommit = async (percentage: number) => {
    isDraggingRef.current = false;
    if (sliderDebounceRef.current !== null) {
      clearTimeout(sliderDebounceRef.current);
      sliderDebounceRef.current = null;
    }

    try {
      await applyBrightness(percentage);
    } catch {
    }
  };

  const handleSliderWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();

    const direction = event.deltaY > 0 ? -1 : 1;

    const nextPercentage = Math.max(
      SLIDER.MIN,
      Math.min(
        SLIDER.MAX,
        currentPercentageRef.current + (direction * SLIDER.WHEEL_STEP)
      )
    );

    if (nextPercentage === currentPercentageRef.current) {
      return;
    }

    previewPercentage(nextPercentage);

    if (wheelDebounceRef.current !== null) {
      clearTimeout(wheelDebounceRef.current);
    }

    wheelDebounceRef.current = setTimeout(async () => {
      try {
        await applyBrightness(nextPercentage);
      } catch {
      } finally {
        wheelDebounceRef.current = null;
      }
    }, 60);
  };

  if (loading) {
    return (
      <div className="mica-window">
        <TitleBar minimal onClose={hideWindow} />
        <div className="app-loading">
          <span>Detecting HDR displays...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mica-window">
        <TitleBar minimal onClose={hideWindow} />
        <div className="app-container">
          <div className="error-message">{error}</div>
        </div>
      </div>
    );
  }

  if (displays.length === 0) {
    return (
      <div className="mica-window">
        <TitleBar minimal onClose={hideWindow} />
        <div className="app-container">
          <div className="error-message">
            No HDR displays found.
            <br />
            Please enable HDR in Windows Settings.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mica-window">
      <TitleBar
        onMouseDown={handleTitleBarMouseDown}
        refreshing={isRefreshing}
        onRefresh={() => refreshDisplays()}
        onOpenSettings={() => setShowSettings(true)}
        onClose={hideWindow}
      />

      {notice ? (
        <div className="notice-banner" role="status" aria-live="polite">
          <div className="notice-copy">
            <strong>{notice.title}</strong>
            <span>{notice.message}</span>
          </div>
          <button
            className="notice-dismiss"
            type="button"
            onClick={() => setNotice(null)}
            title="Dismiss"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      ) : null}

      <div className="main-layout">
        <DeviceNav
          displays={displays}
          selectedIndex={selectedIndex}
          onSelect={selectDisplay}
        />

        <section className="content">
          <BrightnessSlider
            value={currentPercentage}
            onChange={handleSliderChange}
            onPointerDown={handleSliderDown}
            onCommit={handleSliderCommit}
            onWheelAdjust={handleSliderWheel}
          />
          <StatusBar hdrActive={hdrActive} />
        </section>
      </div>

      <SettingsDialog
        open={showSettings}
        autostartEnabled={autostartEnabled}
        hotkeys={hotkeys}
        onClose={() => setShowSettings(false)}
        onToggleAutostart={handleToggleAutostart}
        onUpdateHotkey={handleHotkeyChange}
        onResetHotkeys={handleHotkeyReset}
        onShowAbout={() => setShowAbout(true)}
        onQuit={handleQuit}
      />

      <AboutDialog
        open={showAbout}
        hotkeys={hotkeys}
        onClose={() => setShowAbout(false)}
      />

      <StartupInfoDialog
        open={showStartupInfo}
        displays={displays}
        onClose={closeStartupOverlay}
      />
    </div>
  );
}

export default App;

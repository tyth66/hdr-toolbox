import { useEffect, useRef, useState } from "react";
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
import { useDisplays } from "./hooks/useDisplays";
import { useHotkeys } from "./hooks/useHotkeys";
import { useStartupOverlay } from "./hooks/useStartupOverlay";
import { useWindowPosition } from "./hooks/useWindowPosition";
import { quit } from "./services/tauriApi";

export type { DisplayInfo } from "./types";

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const isDraggingRef = useRef(false);
  const sliderDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    error,
    loadDisplays,
    previewPercentage,
    applyBrightness,
  } = useDisplays({
    showWindow,
    startStartupOverlay,
  });

  useHotkeys({ currentPercentageRef, applyBrightness });

  useEffect(() => {
    loadDisplays();

    isEnabled().then(setAutostartEnabled).catch((err) => {
      console.warn("Failed to get autostart status:", err);
    });

    const unlistenShowWindow = listen("show-window", async () => {
      await showWindow();
    });

    const unlistenSelectDisplay = listen<number>("select-display", (event) => {
      selectDisplay(event.payload);
    });

    return () => {
      unlistenShowWindow.then((fn) => fn());
      unlistenSelectDisplay.then((fn) => fn());
    };
  }, [loadDisplays, selectDisplay, showWindow]);

  useEffect(() => {
    return () => {
      if (sliderDebounceRef.current !== null) {
        clearTimeout(sliderDebounceRef.current);
      }
    };
  }, []);

  const handleToggleAutostart = async () => {
    if (autostartEnabled) {
      await disable();
      setAutostartEnabled(false);
      return;
    }

    await enable();
    setAutostartEnabled(true);
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
        } catch (err) {
          console.error("Failed to set brightness:", err);
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
    } catch (err) {
      console.error("Failed to set brightness:", err);
    }
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
        onOpenSettings={() => setShowSettings(true)}
        onClose={hideWindow}
      />

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
          />
          <StatusBar hdrActive={hdrActive} />
        </section>
      </div>

      <SettingsDialog
        open={showSettings}
        autostartEnabled={autostartEnabled}
        onClose={() => setShowSettings(false)}
        onToggleAutostart={handleToggleAutostart}
        onShowAbout={() => setShowAbout(true)}
        onQuit={quit}
      />

      <AboutDialog open={showAbout} onClose={() => setShowAbout(false)} />

      <StartupInfoDialog
        open={showStartupInfo}
        displays={displays}
        onClose={closeStartupOverlay}
      />
    </div>
  );
}

export default App;

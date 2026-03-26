import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import "./styles.css";
import HeaderIcon from "../src-tauri/icons/fluent@1x.png";

interface DisplayInfo {
  name: string;
  nits: number;
  hdr_enabled: boolean;
  adapter_id_low: number;
  adapter_id_high: number;
  target_id: number;
}

const HOTKEY_INCREASE = "Ctrl+Alt+Up";
const HOTKEY_DECREASE = "Ctrl+Alt+Down";
const HOTKEY_STEP = 40;
const MIN_NITS = 80;
const MAX_NITS = 480;

function App() {
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentNits, setCurrentNits] = useState(200);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showStartupInfo, setShowStartupInfo] = useState(false);
  // Use ref to always have fresh display list in async listeners
  const displaysRef = useRef<DisplayInfo[]>([]);
  // Track if user is actively dragging the slider (for real-time updates)
  const isDraggingRef = useRef(false);
  // Debounce timer for real-time slider apply
  const sliderDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    displaysRef.current = displays;
  }, [displays]);

  // Show window helper
  const showWindow = useCallback(async () => {
    try {
      const win = getCurrentWindow();
      await win.show();
      await win.setFocus();
      await win.center();
    } catch (e) {
      // Ignore errors (window might be destroyed)
    }
  }, []);

  // Load displays on mount
  const loadDisplays = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await invoke<DisplayInfo[]>("get_hdr_displays");
      setDisplays(result);
      displaysRef.current = result;

      // Cache displays in Rust state (for tray menu) and update tooltip
      await invoke("update_displays_and_tooltip", { displays: result });

      if (result.length > 0) {
        setSelectedIndex(0);
        setCurrentNits(result[0].nits);
        // Show startup info - first show the window, then display the info
        await showWindow();
        setShowStartupInfo(true);
        setTimeout(() => {
          setShowStartupInfo(false);
          getCurrentWindow().hide();
        }, 4000);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [showWindow]);

  useEffect(() => {
    loadDisplays();

    // Listen for about event from tray menu
    const unlistenAbout = listen("show-about", () => {
      setShowAbout(true);
      showWindow();
    });

    // Listen for autostart toggle from tray menu
    const unlistenAutostart = listen("toggle-autostart", async () => {
      try {
        const enabled = await isEnabled();
        if (enabled) {
          await disable();
        } else {
          await enable();
        }
      } catch (e) {
        console.error("Failed to toggle autostart:", e);
      }
    });

    // Listen for device selection from tray menu
    const unlistenSelectDisplay = listen<number>("select-display", (event) => {
      const idx = event.payload;
      const currentDisplays = displaysRef.current;
      if (idx >= 0 && idx < currentDisplays.length) {
        setSelectedIndex(idx);
        setCurrentNits(currentDisplays[idx].nits);
        showWindow();
      }
    });

    return () => {
      unlistenAbout.then((fn) => fn());
      unlistenAutostart.then((fn) => fn());
      unlistenSelectDisplay.then((fn) => fn());
    };
  }, [loadDisplays, showWindow]);

  // Hide window on blur (matches original C++ behavior: WM_ACTIVATE + WA_INACTIVE)
  useEffect(() => {
    let unlistenBlur: (() => void) | null = null;

    const setupBlurListener = async () => {
      try {
        const win = getCurrentWindow();
        unlistenBlur = await win.listen("blur", async () => {
          // Don't hide if startup info or about dialog is showing
          if (showStartupInfo) return;
          await win.hide();
        });
      } catch (e) {
        // Ignore errors (window might not be available in all contexts)
      }
    };

    setupBlurListener();

    return () => {
      if (unlistenBlur) {
        unlistenBlur();
      }
    };
  }, [showStartupInfo]);

  // Register global hotkeys - use refs to avoid stale closures
  useEffect(() => {
    const setupHotkeys = async () => {
      try {
        await register(HOTKEY_INCREASE, async () => {
          const idx = selectedIndex;
          const displayList = displaysRef.current;
          const display = displayList[idx];
          if (!display) return;
          const newNits = Math.min(currentNits + HOTKEY_STEP, MAX_NITS);
          const clampedNits = Math.max(MIN_NITS, Math.min(MAX_NITS, newNits));
          try {
            await invoke("set_brightness", {
              adapterLow: display.adapter_id_low,
              adapterHigh: display.adapter_id_high,
              targetId: display.target_id,
              nits: clampedNits,
            });
            setCurrentNits(clampedNits);
            const updatedDisplays = displayList.map((d, i) =>
              i === idx ? { ...d, nits: clampedNits } : d
            );
            setDisplays(updatedDisplays);
            // Use tooltip-only update to avoid menu rebuild on hotkey presses
            await invoke("update_tray_tooltip_only");
          } catch (e) {
            console.error("Failed to set brightness:", e);
          }
        });

        await register(HOTKEY_DECREASE, async () => {
          const idx = selectedIndex;
          const displayList = displaysRef.current;
          const display = displayList[idx];
          if (!display) return;
          const newNits = Math.max(currentNits - HOTKEY_STEP, MIN_NITS);
          const clampedNits = Math.max(MIN_NITS, Math.min(MAX_NITS, newNits));
          try {
            await invoke("set_brightness", {
              adapterLow: display.adapter_id_low,
              adapterHigh: display.adapter_id_high,
              targetId: display.target_id,
              nits: clampedNits,
            });
            setCurrentNits(clampedNits);
            const updatedDisplays = displayList.map((d, i) =>
              i === idx ? { ...d, nits: clampedNits } : d
            );
            setDisplays(updatedDisplays);
            // Use tooltip-only update to avoid menu rebuild on hotkey presses
            await invoke("update_tray_tooltip_only");
          } catch (e) {
            console.error("Failed to set brightness:", e);
          }
        });
      } catch (e) {
        console.warn("Failed to register hotkeys:", e);
      }
    };

    setupHotkeys();

    return () => {
      unregister(HOTKEY_INCREASE).catch(() => {});
      unregister(HOTKEY_DECREASE).catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNits, selectedIndex]);

  // Apply brightness to a single display
  const applyBrightness = useCallback(async (nits: number) => {
    const display = displays[selectedIndex];
    if (!display) return;

    const clampedNits = Math.max(MIN_NITS, Math.min(MAX_NITS, nits));

    try {
      await invoke("set_brightness", {
        adapterLow: display.adapter_id_low,
        adapterHigh: display.adapter_id_high,
        targetId: display.target_id,
        nits: clampedNits,
      });

      setCurrentNits(clampedNits);

      // Update the display's cached nits value and sync to Rust state/tooltip
      const updatedDisplays = displays.map((d, i) =>
        i === selectedIndex ? { ...d, nits: clampedNits } : d
      );
      setDisplays(updatedDisplays);
      await invoke("update_displays_and_tooltip", { displays: updatedDisplays });
    } catch (e) {
      console.error("Failed to set brightness:", e);
    }
  }, [displays, selectedIndex]);

  // Apply current brightness to ALL HDR displays
  const applyToAll = async () => {
    try {
      const updatedDisplays = displays.map((d) => ({ ...d, nits: currentNits }));
      await invoke("set_brightness_all", {
        displays: updatedDisplays,
        nits: currentNits,
      });
      setDisplays(updatedDisplays);
      await invoke("update_displays_and_tooltip", { displays: updatedDisplays });
    } catch (e) {
      console.error("Failed to apply to all:", e);
    }
  };

  // Handle device selection
  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = parseInt(e.target.value, 10);
    setSelectedIndex(idx);
    setCurrentNits(displays[idx].nits);
  };

  // Handle slider change (real-time)
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nits = parseInt(e.target.value, 10);
    setCurrentNits(nits);

    // Update progress CSS variable
    const progress = ((nits - MIN_NITS) / (MAX_NITS - MIN_NITS)) * 100;
    e.target.style.setProperty("--progress", `${progress}%`);

    // Real-time brightness apply during drag (debounced ~50ms)
    if (sliderDebounceRef.current !== null) {
      clearTimeout(sliderDebounceRef.current);
    }
    sliderDebounceRef.current = setTimeout(async () => {
      if (isDraggingRef.current) {
        await applyBrightness(nits);
      }
    }, 50);
  };

  // Handle slider drag start
  const handleSliderDown = () => {
    isDraggingRef.current = true;
  };

  // Handle slider commit (on mouse up / touch end)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSliderCommit = async (e: any) => {
    isDraggingRef.current = false;
    if (sliderDebounceRef.current !== null) {
      clearTimeout(sliderDebounceRef.current);
      sliderDebounceRef.current = null;
    }
    const nits = parseInt(e.target.value, 10);
    await applyBrightness(nits);
  };

  // Calculate slider progress percentage
  const sliderProgress = ((currentNits - MIN_NITS) / (MAX_NITS - MIN_NITS)) * 100;

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading">Detecting HDR displays...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container">
        <div className="error-message">
          {error}
        </div>
      </div>
    );
  }

  if (displays.length === 0) {
    return (
      <div className="app-container">
        <div className="error-message">
          No HDR displays found.
          <br />
          Please enable HDR in Windows Settings.
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="header">
        <img className="header-icon" src={HeaderIcon} alt="HDR icon" />
        <span className="header-title">HDR-SDR Brightness</span>
      </div>
      <div className="device-selector">
        <label>Display</label>
        <select value={selectedIndex} onChange={handleDeviceChange}>
          {displays.map((d, i) => (
            <option key={i} value={i}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="slider-section">
        <div className="slider-value">
          {currentNits}
          <span className="slider-unit"> nits</span>
        </div>

        <div className="slider-container">
          <input
            type="range"
            min={MIN_NITS}
            max={MAX_NITS}
            step={40}
            value={currentNits}
            onChange={handleSliderChange}
            onMouseDown={handleSliderDown}
            onMouseUp={handleSliderCommit}
            onTouchEnd={handleSliderCommit}
            style={{ "--progress": `${sliderProgress}%` } as React.CSSProperties}
          />
          <div className="slider-range">
            <span>{MIN_NITS}</span>
            <span>{MAX_NITS}</span>
          </div>
        </div>
      </div>

      <div className="actions">
        <button className="btn btn-secondary" onClick={applyToAll}>
          Apply All
        </button>
        <button className="btn btn-primary" onClick={() => setShowAbout(true)}>
          About
        </button>
      </div>

      {showAbout && (
        <div className="about-overlay" onClick={() => setShowAbout(false)}>
          <div className="about-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>HDR Toolbox</h2>
            <p>
              A lightweight tool for adjusting HDR monitor SDR brightness without opening Windows Settings.
            </p>
            <div className="shortcuts">
              <div>
                <strong>Left-click tray:</strong> Toggle slider
              </div>
              <div>
                <strong>Right-click tray:</strong> Menu
              </div>
              <div>
                <strong>Ctrl+Alt+↑:</strong> +{HOTKEY_STEP} nits
              </div>
              <div>
                <strong>Ctrl+Alt+↓:</strong> -{HOTKEY_STEP} nits
              </div>
            </div>
            <p style={{ fontSize: "11px", color: "#999" }}>
              v1.0.0 · MIT License
            </p>
            <button
              className="btn btn-primary close-btn"
              onClick={() => setShowAbout(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showStartupInfo && (
        <div className="about-overlay" onClick={() => setShowStartupInfo(false)}>
          <div className="about-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>HDR Toolbox</h2>
            <p>Detected {displays.length} HDR display(s):</p>
            <ul style={{ textAlign: "left", margin: "8px 0", paddingLeft: "20px" }}>
              {displays.map((d, i) => (
                <li key={i} style={{ marginBottom: "4px" }}>
                  {d.name}: {d.nits} nits
                </li>
              ))}
            </ul>
            <p style={{ fontSize: "11px", color: "#999" }}>
              Auto-closing in a few seconds...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

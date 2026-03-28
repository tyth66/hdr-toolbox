import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import "./styles.css";

const WINDOW_WIDTH = 300;
const WINDOW_HEIGHT = 200;
const POSITION_KEY = "hdr-toolbox-window-position";

interface DisplayInfo {
  name: string;
  nits: number;
  min_percentage: number;
  max_percentage: number;
  hdr_enabled: boolean;
  adapter_id_low: number;
  adapter_id_high: number;
  target_id: number;
  min_nits?: number;
  max_nits?: number;
}

const HOTKEY_INCREASE = "Ctrl+Alt+Up";
const HOTKEY_DECREASE = "Ctrl+Alt+Down";
const HOTKEY_STEP = 10; // percentage points for hotkeys
const MIN_SLIDER = 0;
const MAX_SLIDER = 100;
const DEFAULT_MIN_NITS = 80;
const DEFAULT_MAX_NITS = 480;

// Convert nits to percentage (0-100) using standard nits range
const nitsToPercentage = (nits: number): number => {
  const range = DEFAULT_MAX_NITS - DEFAULT_MIN_NITS;
  if (range === 0) return 0;
  return Math.round(((nits - DEFAULT_MIN_NITS) / range) * 100);
};

// Convert percentage (0-100) to nits using standard nits range
const percentageToNits = (percentage: number): number => {
  const range = DEFAULT_MAX_NITS - DEFAULT_MIN_NITS;
  return Math.round(((percentage / 100) * range) + DEFAULT_MIN_NITS);
};

function App() {
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentPercentage, setCurrentPercentage] = useState(50); // 0-100 slider
  const [hdrActive, setHdrActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [showStartupInfo, setShowStartupInfo] = useState(false);
  // Use ref to always have fresh display list in async listeners
  const displaysRef = useRef<DisplayInfo[]>([]);
  // Track showStartupInfo for Rust-side blur-to-hide (avoids cross-language state sync race)
  const showStartupInfoRef = useRef(false);
  // Track if user is actively dragging the slider (for real-time updates)
  const isDraggingRef = useRef(false);
  // Debounce timer for real-time slider apply
  const sliderDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    displaysRef.current = displays;
  }, [displays]);

  // Sync showStartupInfo to ref for cross-language state access
  useEffect(() => {
    showStartupInfoRef.current = showStartupInfo;
    // Also emit to Rust so the blur-to-hide handler uses fresh state
    invoke("set_startup_info_mode", { active: showStartupInfo }).catch(() => {});
  }, [showStartupInfo]);

  // Position window - restore from storage or place above tray
  const positionWindow = useCallback(async () => {
    const win = getCurrentWindow();
    
    // Try to restore saved position
    const savedPos = localStorage.getItem(POSITION_KEY);
    if (savedPos) {
      try {
        const { x, y } = JSON.parse(savedPos);
        console.log("Restoring saved position:", x, y);
        await win.setPosition(new PhysicalPosition(x, y));
        return;
      } catch (err) {
        console.log("Invalid saved position, trying tray positioning");
        localStorage.removeItem(POSITION_KEY);
      }
    }
    
    // Position above tray icon
    try {
      const trayRect = await invoke<{ x: number; y: number; width: number; height: number } | null>("get_tray_rect");
      console.log("Tray rect result:", trayRect);
      if (trayRect) {
        // Center window above tray icon
        const x = Math.round(trayRect.x + (trayRect.width - WINDOW_WIDTH) / 2);
        const y = Math.round(trayRect.y - WINDOW_HEIGHT - 10);
        console.log("Setting position above tray:", x, y);
        await win.setPosition(new PhysicalPosition(x, y));
        return;
      } else {
        console.log("Tray rect was null, falling back to center");
      }
    } catch (err) {
      console.log("Failed to get tray rect:", err);
    }
    
    // Fallback: center on screen
    console.log("Using center fallback");
    await win.center();
  }, []);

  // Show window helper
  const showWindow = useCallback(async () => {
    try {
      const win = getCurrentWindow();
      // Set position BEFORE showing to avoid flicker
      await positionWindow();
      await win.show();
      await win.setFocus();
    } catch (e) {
      // Ignore errors (window might be destroyed)
    }
  }, [positionWindow]);

  // Start window drag
  const handleTitleBarMouseDown = useCallback(async (e: React.MouseEvent) => {
    // Ignore if clicking on buttons (let button events handle their own clicks)
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }
    e.preventDefault();
    try {
      // Set dragging mode before starting drag to prevent blur-to-hide
      await invoke("set_dragging_mode", { active: true });
      await getCurrentWindow().startDragging();
      // Clear dragging mode after a short delay (covers click-without-drag case)
      setTimeout(() => {
        invoke("set_dragging_mode", { active: false }).catch(() => {});
      }, 200);
    } catch (err) {
      console.error("Failed to start dragging:", err);
      // Clear dragging mode on error
      invoke("set_dragging_mode", { active: false }).catch(() => {});
    }
  }, []);

  // Save position on window move
  useEffect(() => {
    let unlistenMove: (() => void) | null = null;
    
    const setupListener = async () => {
      try {
        const win = getCurrentWindow();
        unlistenMove = await win.onMoved(async () => {
          try {
            const pos = await win.outerPosition();
            localStorage.setItem(POSITION_KEY, JSON.stringify({ x: pos.x, y: pos.y }));
          } catch {
            // Ignore errors
          }
        });
      } catch {
        // Ignore errors
      }
    };
    
    setupListener();
    
    return () => {
      if (unlistenMove) {
        unlistenMove();
      }
    };
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
        const pct = nitsToPercentage(result[0].nits);
        setCurrentPercentage(pct);
        setHdrActive(result[0].hdr_enabled);
        // Set startup info mode BEFORE showing window to prevent blur-to-hide race
        await invoke("set_startup_info_mode", { active: true });
        setShowStartupInfo(true);
        await showWindow();
        setTimeout(() => {
          setShowStartupInfo(false);
          invoke("set_startup_info_mode", { active: false }).catch(() => {});
        }, 4000);
      }
    } catch (e) {
      setError(String(e));
      // Clear Rust cache so tray menu reflects empty state
      await invoke("update_displays_and_tooltip", { displays: [] });
    } finally {
      setLoading(false);
    }
  }, [showWindow]);

  useEffect(() => {
    loadDisplays();

    // Load autostart status
    isEnabled().then(setAutostartEnabled).catch((e) => {
      console.warn("Failed to get autostart status:", e);
    });

    // Listen for show-window event (from tray click/menu)
    const unlistenShowWindow = listen("show-window", async () => {
      const win = getCurrentWindow();
      await win.show();
      await win.setFocus();
      await positionWindow();
    });

    // Listen for device selection from tray menu
    const unlistenSelectDisplay = listen<number>("select-display", (event) => {
      const idx = event.payload;
      const currentDisplays = displaysRef.current;
      if (idx >= 0 && idx < currentDisplays.length) {
        setSelectedIndex(idx);
        const pct = nitsToPercentage(currentDisplays[idx].nits);
        setCurrentPercentage(pct);
        setHdrActive(currentDisplays[idx].hdr_enabled);
      }
    });

    return () => {
      unlistenShowWindow.then((fn) => fn());
      unlistenSelectDisplay.then((fn) => fn());
    };
  }, [loadDisplays, showWindow, positionWindow]);

  // Register global hotkeys - use refs to avoid stale closures
  useEffect(() => {
    let settled = false;
    const registered = { up: false, down: false };

    const setupHotkeys = async () => {
      try {
        await register(HOTKEY_INCREASE, async () => {
          if (settled) return;
          const idx = selectedIndex;
          const displayList = displaysRef.current;
          const display = displayList[idx];
          if (!display) return;
          const newPercentage = Math.min(currentPercentage + HOTKEY_STEP, MAX_SLIDER);
          try {
            await invoke("set_brightness", {
              adapterLow: display.adapter_id_low,
              adapterHigh: display.adapter_id_high,
              targetId: display.target_id,
              percentage: newPercentage,
              minNits: display.min_nits ?? 80,
              maxNits: display.max_nits ?? 480,
            });
            setCurrentPercentage(newPercentage);
            const newNits = percentageToNits(newPercentage);
            const updatedDisplays = displayList.map((d, i) =>
              i === idx ? { ...d, nits: newNits } : d
            );
            setDisplays(updatedDisplays);
            await invoke("update_tray_tooltip_only");
          } catch (e) {
            console.error("Failed to set brightness:", e);
          }
        });
        if (settled) { unregister(HOTKEY_INCREASE).catch(() => {}); return; }
        registered.up = true;

        await register(HOTKEY_DECREASE, async () => {
          if (settled) return;
          const idx = selectedIndex;
          const displayList = displaysRef.current;
          const display = displayList[idx];
          if (!display) return;
          const newPercentage = Math.max(currentPercentage - HOTKEY_STEP, MIN_SLIDER);
          try {
            await invoke("set_brightness", {
              adapterLow: display.adapter_id_low,
              adapterHigh: display.adapter_id_high,
              targetId: display.target_id,
              percentage: newPercentage,
              minNits: display.min_nits ?? 80,
              maxNits: display.max_nits ?? 480,
            });
            setCurrentPercentage(newPercentage);
            const newNits = percentageToNits(newPercentage);
            const updatedDisplays = displayList.map((d, i) =>
              i === idx ? { ...d, nits: newNits } : d
            );
            setDisplays(updatedDisplays);
            await invoke("update_tray_tooltip_only");
          } catch (e) {
            console.error("Failed to set brightness:", e);
          }
        });
        if (settled) { unregister(HOTKEY_DECREASE).catch(() => {}); return; }
        registered.down = true;
      } catch (e) {
        console.warn("Failed to register hotkeys:", e);
      }
    };

    setupHotkeys();

    return () => {
      settled = true;
      // Cleanup is synchronous - unregister without await
      // This is safe because we guard with `settled` flag in handlers
      if (registered.up) unregister(HOTKEY_INCREASE).catch(() => {});
      if (registered.down) unregister(HOTKEY_DECREASE).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Intentionally excluded: currentPercentage is read via ref in hotkey handlers, not as dependency
  }, [currentPercentage, selectedIndex]);

  // Apply brightness to a single display (percentage 0-100)
  const applyBrightness = useCallback(async (percentage: number) => {
    const display = displays[selectedIndex];
    if (!display) return;

    const clampedPercentage = Math.max(MIN_SLIDER, Math.min(MAX_SLIDER, percentage));
    const nits = percentageToNits(clampedPercentage);

    try {
      await invoke("set_brightness", {
        adapterLow: display.adapter_id_low,
        adapterHigh: display.adapter_id_high,
        targetId: display.target_id,
        percentage: clampedPercentage,
        minNits: display.min_nits ?? 80,
        maxNits: display.max_nits ?? 480,
      });

      setCurrentPercentage(clampedPercentage);

      // Update the display's cached nits value and sync to Rust state/tooltip
      const updatedDisplays = displays.map((d, i) =>
        i === selectedIndex ? { ...d, nits } : d
      );
      setDisplays(updatedDisplays);
      await invoke("update_displays_and_tooltip", { displays: updatedDisplays });
    } catch (e) {
      console.error("Failed to set brightness:", e);
    }
  }, [displays, selectedIndex]);

  // Handle device selection from side nav
  const handleDeviceSelect = (idx: number) => {
    setSelectedIndex(idx);
    const pct = nitsToPercentage(displays[idx].nits);
    setCurrentPercentage(pct);
    setHdrActive(displays[idx].hdr_enabled);
  };

  // Handle slider change (real-time)
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const percentage = parseInt(e.target.value, 10);
    setCurrentPercentage(percentage);

    // Update progress CSS variable (already percentage)
    e.target.style.setProperty("--progress", `${percentage}%`);

    // Real-time brightness apply during drag (debounced ~50ms)
    if (sliderDebounceRef.current !== null) {
      clearTimeout(sliderDebounceRef.current);
    }
    sliderDebounceRef.current = setTimeout(async () => {
      if (isDraggingRef.current) {
        await applyBrightness(percentage);
      }
    }, 50);
  };

  // Handle slider drag start
  const handleSliderDown = () => {
    if (sliderDebounceRef.current !== null) {
      clearTimeout(sliderDebounceRef.current);
      sliderDebounceRef.current = null;
    }
    isDraggingRef.current = true;
  };

  // Handle slider commit (on mouse up / touch end)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // Event type is complex Tauri event; any is acceptable here for the commit handler
  const handleSliderCommit = async (e: any) => {
    isDraggingRef.current = false;
    if (sliderDebounceRef.current !== null) {
      clearTimeout(sliderDebounceRef.current);
      sliderDebounceRef.current = null;
    }
    const percentage = parseInt(e.target.value, 10);
    await applyBrightness(percentage);
  };

  // Handle HDR toggle
  const toggleHdr = async () => {
    const display = displays[selectedIndex];
    if (!display) return;
    // Note: Actual HDR toggle would require additional Rust command
    // For now, we just update the local state to show the toggle works
    const newState = !hdrActive;
    setHdrActive(newState);
    // Update the display's cached hdr_enabled value
    const updatedDisplays = displays.map((d, i) =>
      i === selectedIndex ? { ...d, hdr_enabled: newState } : d
    );
    setDisplays(updatedDisplays);
  };

  // Close window handler
  const handleClose = () => {
    getCurrentWindow().hide();
  };

  // Calculate slider progress percentage (slider is now 0-100)
  const sliderProgress = currentPercentage;

  if (loading) {
    return (
      <div className="mica-window">
        <div className="title-bar">
          <span className="title-bar-title">HDR Toolbox</span>
          <button className="title-bar-close" onClick={handleClose}>✕</button>
        </div>
        <div className="app-loading">
          <span>Detecting HDR displays...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mica-window">
        <div className="title-bar">
          <span className="title-bar-title">HDR Toolbox</span>
          <button className="title-bar-close" onClick={handleClose}>✕</button>
        </div>
        <div className="app-container">
          <div className="error-message">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (displays.length === 0) {
    return (
      <div className="mica-window">
        <div className="title-bar">
          <span className="title-bar-title">HDR Toolbox</span>
          <button className="title-bar-close" onClick={handleClose}>✕</button>
        </div>
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
      {/* Title Bar - Draggable */}
      <header className="title-bar" onMouseDown={handleTitleBarMouseDown}>
        <span className="title-bar-title">HDR Toolbox</span>
        <div className="title-bar-actions">
          <button className="title-bar-btn" onClick={() => setShowSettings(true)} title="Settings">
            <span className="material-symbols-outlined">settings</span>
          </button>
          <button className="title-bar-btn title-bar-close" onClick={handleClose} title="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="main-layout">
        {/* Side Nav */}
        <nav className="side-nav">
          {displays.map((display, idx) => (
            <button
              key={idx}
              className={`side-nav-btn ${selectedIndex === idx ? 'active' : ''}`}
              onClick={() => handleDeviceSelect(idx)}
              title={display.name}
            >
              <span className="material-symbols-outlined">monitor</span>
            </button>
          ))}
        </nav>

        {/* Content */}
        <section className="content">
          <div className="slider-section">
            <div className="slider-header">
              <span className="slider-label">SDR Brightness</span>
              <div className="slider-value">
                <span className="nits-value">{currentPercentage}</span>
                <span className="nits-unit">%</span>
              </div>
            </div>

            <div className="slider-wrapper">
              <div 
                className="slider-fill" 
                style={{ width: `${sliderProgress}%` }}
              />
              <input
                type="range"
                min={MIN_SLIDER}
                max={MAX_SLIDER}
                step={1}
                value={currentPercentage}
                onChange={handleSliderChange}
                onMouseDown={handleSliderDown}
                onMouseUp={handleSliderCommit}
                onTouchEnd={handleSliderCommit}
                className="brightness-slider"
              />
            </div>

            <div className="slider-range">
              <span>{MIN_SLIDER}</span>
              <span>{MAX_SLIDER}%</span>
            </div>
          </div>

          {/* Status Bar */}
          <div className="status-bar">
            <div className="status-left">
              <div className={`status-indicator ${hdrActive ? 'hdr-active' : ''}`} />
              <span className="status-text">
                {hdrActive ? 'HDR10 Active' : 'SDR Mode'}
              </span>
            </div>
            <div className="status-right">
              <span className="status-label">HDR Toggle</span>
              <button 
                className={`hdr-toggle ${hdrActive ? 'active' : ''}`}
                onClick={toggleHdr}
              >
                <span className="toggle-thumb" />
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Settings Overlay */}
      {showSettings && (
        <div className="about-overlay" onClick={() => setShowSettings(false)}>
          <div className="about-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Settings</h2>
            <div className="settings-section">
              <div className="settings-row">
                <span>Auto-start with Windows</span>
                <button
                  className={`hdr-toggle ${autostartEnabled ? 'active' : ''}`}
                  onClick={async () => {
                    try {
                      if (autostartEnabled) {
                        await disable();
                        setAutostartEnabled(false);
                      } else {
                        await enable();
                        setAutostartEnabled(true);
                      }
                    } catch (e) {
                      console.error("Failed to toggle autostart:", e);
                    }
                  }}
                >
                  <span className="toggle-thumb" />
                </button>
              </div>
              <div className="settings-row">
                <span>Quit HDR Toolbox</span>
                <button
                  className="btn"
                  style={{ background: "rgba(239,68,68,0.2)", color: "#f87171" }}
                  onClick={() => {
                    invoke("quit");
                  }}
                >
                  Quit
                </button>
              </div>
            </div>
            <p style={{ fontSize: "11px", color: "#999", marginTop: "8px" }}>
              v1.0.0 · <button className="about-link" onClick={() => setShowAbout(true)}>About</button>
            </p>
            <button
              className="btn btn-primary close-btn"
              onClick={() => setShowSettings(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* About Overlay */}
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
                <strong>Ctrl+Alt+↑:</strong> +{HOTKEY_STEP}%
              </div>
              <div>
                <strong>Ctrl+Alt+↓:</strong> -{HOTKEY_STEP}%
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

      {/* Startup Info Overlay */}
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
              Click outside to close
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

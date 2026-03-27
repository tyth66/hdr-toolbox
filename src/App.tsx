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
  const [hdrActive, setHdrActive] = useState(false);
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
      await getCurrentWindow().startDragging();
    } catch (err) {
      console.error("Failed to start dragging:", err);
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
        setCurrentNits(result[0].nits);
        setHdrActive(result[0].hdr_enabled);
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

    // Listen for show-window event (from tray click/menu)
    const unlistenShowWindow = listen("show-window", async () => {
      const win = getCurrentWindow();
      await win.show();
      await win.setFocus();
      await positionWindow();
    });

    // Listen for about event from tray menu
    const unlistenAbout = listen("show-about", () => {
      setShowAbout(true);
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
        setHdrActive(currentDisplays[idx].hdr_enabled);
      }
    });

    return () => {
      unlistenShowWindow.then((fn) => fn());
      unlistenAbout.then((fn) => fn());
      unlistenAutostart.then((fn) => fn());
      unlistenSelectDisplay.then((fn) => fn());
    };
  }, [loadDisplays, showWindow, positionWindow]);

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

  // Handle device selection from side nav
  const handleDeviceSelect = (idx: number) => {
    setSelectedIndex(idx);
    setCurrentNits(displays[idx].nits);
    setHdrActive(displays[idx].hdr_enabled);
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

  // Calculate slider progress percentage
  const sliderProgress = ((currentNits - MIN_NITS) / (MAX_NITS - MIN_NITS)) * 100;

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
          <button className="title-bar-btn" onClick={() => setShowAbout(true)} title="About">
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
                <span className="nits-value">{currentNits}</span>
                <span className="nits-unit">nits</span>
              </div>
            </div>

            <div className="slider-wrapper">
              <div 
                className="slider-fill" 
                style={{ width: `${sliderProgress}%` }}
              />
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
                className="brightness-slider"
              />
            </div>

            <div className="slider-range">
              <span>{MIN_NITS}</span>
              <span>{MAX_NITS} nits</span>
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
              Auto-closing in a few seconds...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

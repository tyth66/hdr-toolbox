# Frontend — React/TypeScript UI Layer

**Parent:** ./AGENTS.md (root)

**Generated:** 2026-03-28 (refreshed)

## OVERVIEW

Single-page React 18 app — slider UI for HDR brightness. Windows 11 Mica glass-morphism design. 684 lines TSX + 578 lines CSS.

## STRUCTURE

```
src/
├── App.tsx              # Main component: slider, device nav, overlays (684 lines)
├── main.tsx             # React mount + Tauri close-to-hide handler (18 lines)
├── styles.css           # Windows 11 Mica design, glass-morphism, dark theme (578 lines)
└── vite-env.d.ts       # Vite type reference
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Slider logic + debounce | App.tsx:handleSliderChange, sliderDebounceRef | 50ms debounce on drag |
| Device switching | App.tsx:handleDeviceSelect | Side nav buttons |
| Real-time brightness apply | App.tsx:applyBrightness | Debounced, updates Rust state |
| Hotkey handlers | App.tsx:useEffect (Ctrl+Alt+↑/↓) | Refs for stale closure avoidance |
| Tauri event listeners | App.tsx:useEffect (mount) | show-window, select-display |
| Window positioning | App.tsx:positionWindow | Restore from localStorage or place above tray |
| Startup overlay | App.tsx:loadDisplays | 4s auto-dismiss (info only), main window stays |
| Settings overlay | App.tsx:showSettings state | Autostart toggle + quit button |
| About overlay | App.tsx:showAbout state | Shortcuts + description |
| Close-to-hide | main.tsx:onCloseRequested | `event.preventDefault()` + `window.hide()` |
| CSS slider styling | styles.css:.brightness-slider | WebKit/Moz custom thumb |

## STATE MANAGEMENT

| Hook | Purpose |
|------|---------|
| `useState` | `displays[]`, `selectedIndex`, `currentNits`, `loading`, `error`, `showSettings`, `showAbout`, `autostartEnabled`, `showStartupInfo` |
| `useEffect` | Load displays, hotkey setup, position listener, autostart status |
| `useCallback` | `showWindow`, `loadDisplays`, `applyBrightness`, `positionWindow` |
| `useRef` | `displaysRef` (async sync), `isDraggingRef`, `sliderDebounceRef`, `showStartupInfoRef` |

**Ref sync pattern**: `displaysRef.current = displays` kept in sync for async event listeners that need fresh display list.

## TAURI INTEGRATION

```typescript
// Commands → Rust
invoke("get_hdr_displays")              // → DisplayInfo[] (luminance from EDID, DXGI migration planned)
invoke("set_brightness", {adapterLow, adapterHigh, targetId, percentage, minNits, maxNits})
invoke("set_brightness_all", {displays, percentage})  // Uses luminance range from DisplayInfo
invoke("update_displays_and_tooltip", {displays})
invoke("update_tray_tooltip_only")
invoke("get_tray_rect")                 // → {x,y,width,height} | null
invoke("set_startup_info_mode", {active: boolean})
invoke("quit")                          // Exit process (bypasses close-to-hide)

// Events ← Rust
listen("show-window", ...)              // From tray left-click
listen("select-display", payload: idx)  // From tray menu device selection

// JS-only (no Rust involved)
enable() / disable() / isEnabled()      // Autostart plugin
```

**DisplayInfo interface** (App.tsx):
```typescript
interface DisplayInfo {
  name: string;
  nits: number;
  min_percentage: number;
  max_percentage: number;
  hdr_enabled: boolean;
  adapter_id_low: number;
  adapter_id_high: number;
  target_id: number;
  min_nits?: number;   // From luminance source (EDID or DXGI, optional)
  max_nits?: number;   // From luminance source (EDID or DXGI, optional)
}
```

## CONSTANTS

```typescript
WINDOW_WIDTH = 300
WINDOW_HEIGHT = 200
POSITION_KEY = "hdr-toolbox-window-position"  // localStorage key
HOTKEY_INCREASE = "Ctrl+Alt+Up"
HOTKEY_DECREASE = "Ctrl+Alt+Down"
HOTKEY_STEP = 10  // percentage points per hotkey press
MIN_NITS = 80
MAX_NITS = 480
SLIDER_STEP = 40  // matches API requirement (multiples of 4)
```

## STYLING

- **Plain CSS**: No preprocessor, CSS variables for theming
- **Design**: Windows 11 Mica with glass-morphism (`backdrop-filter: blur(40px)`)
- **Theme**: Dark by default, light mode via `prefers-color-scheme` media query
- **Accent**: `#0078d4` (Windows blue)
- **Typography**: Inter font, Material Symbols Outlined icons
- **Slider**: Custom WebKit/Moz thumbs with glow effect
- **Title bar**: Custom draggable, `-webkit-app-region: drag`, close button calls `window.hide()`

## ANTI-PATTERNS

- **No class components** — hooks only
- **No router** — single window, show/hide via tray
- **No async setState** — use ref pattern for async listeners
- **No `tauri://blur`** — blur handled in Rust via `on_window_event`
- **Quit uses `invoke("quit")`** — bypasses window close-to-hide handler, calls `app.exit(0)` in Rust

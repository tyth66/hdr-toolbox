# Frontend — React/TypeScript UI Layer

**Parent:** ./AGENTS.md (root)

## Overview

Single-page React 18 app — slider UI for HDR brightness control. Windows 11 Mica design with glass-morphism. All code in `App.tsx` (~470 lines).

## Structure

```
src/
├── App.tsx              # Main (only) component, slider + device selector
├── main.tsx             # React mount + Tauri close-to-hide handler
├── styles.css           # Windows 11 Mica design system, glass-morphism
└── vite-env.d.ts       # Vite type reference
```

## Where to Look

| Task | Location |
|------|----------|
| Slider UI logic | App.tsx:handleSliderChange |
| Device switching | App.tsx:handleDeviceChange |
| Debounced brightness apply | App.tsx:sliderDebounceRef |
| Tauri event listeners | main.tsx, App.tsx useEffect |
| Hotkey registration | App.tsx useEffect (Ctrl+Alt+Up/Down) |
| CSS slider styling | styles.css (.slider-range) |

## State Management

| Hook | Purpose |
|------|---------|
| `useState` | displays[], selectedIndex, currentNits, loading, error, showAbout |
| `useEffect` | Load displays, blur listener, hotkey setup |
| `useCallback` | showWindow, loadDisplays, applyBrightness |
| `useRef` | displaysRef (async sync), isDraggingRef, sliderDebounceRef |

**Ref sync pattern**: `displaysRef.current` kept in sync with `displays` state for async listeners.

## Tauri Integration

```typescript
// Commands → Rust
invoke("get_hdr_displays")         // → DisplayInfo[]
invoke("set_brightness", {adapter, target, nits})
invoke("set_brightness_all", {displays, nits})
invoke("update_displays_and_tooltip")

// Events ← Rust
listen("show-about")      // → open about dialog
listen("toggle-autostart") // → toggle autostart
listen("select-display")  // → switch display from tray
```

## Anti-Patterns

- **No class components** — hooks only
- **No router** — single-window, show/hide via tray
- **No async setState** — use ref pattern for async listeners

## Styling

- Plain CSS (no preprocessor)
- Windows 11 Mica design system with CSS variables
- Light/dark mode via `prefers-color-scheme` media query
- Glass-morphism: `backdrop-filter: blur(20px) saturate(180%)` on panels
- Custom title bar: `-webkit-app-region: drag` drag region, close button calls `window.hide()`
- Accent: `#0078d4`, typography: Segoe UI Variable

# Frontend - React/TypeScript UI Layer

**Parent:** ./AGENTS.md
**Generated:** 2026-03-29 (refreshed after refactor)

## OVERVIEW

React 18 single-window UI for HDR brightness control. The frontend is now split into composition, hooks, services, and presentational components.

## STRUCTURE

```text
src/
|- App.tsx                    # Composition layer
|- main.tsx                   # React mount + close-to-hide
|- styles.css                 # Shared styling
|- types.ts                   # DisplayInfo, LUMINANCE, HOTKEYS, SLIDER
|- tauriApi.ts                # Compatibility re-export
|- components/
|  |- TitleBar.tsx
|  |- DeviceNav.tsx
|  |- BrightnessSlider.tsx
|  |- StatusBar.tsx
|  |- SettingsDialog.tsx
|  |- AboutDialog.tsx
|  '- StartupInfoDialog.tsx
|- hooks/
|  |- useDisplays.ts
|  |- useHotkeys.ts
|  |- useWindowPosition.ts
|  '- useStartupOverlay.ts
'- services/
   '- tauriApi.ts
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| App wiring | `App.tsx` | Composes hooks and components |
| Display load/apply logic | `hooks/useDisplays.ts` | Source of truth for display state |
| Hotkeys | `hooks/useHotkeys.ts` | Registers global shortcuts once |
| Window drag/position | `hooks/useWindowPosition.ts` | Tray placement + saved position |
| Startup overlay | `hooks/useStartupOverlay.ts` | Overlay timer + Rust sync |
| Rust bridge | `services/tauriApi.ts` | Typed Tauri calls |

## RULES

- UI components should not call `invoke()` directly
- Keep business logic out of `App.tsx`
- Keep hook responsibilities narrow and explicit
- `types.ts` is the only place for shared frontend constants
- `services/tauriApi.ts` is the only place for typed Rust command wrappers

## CURRENT HOOK OWNERSHIP

- `useDisplays`: display list, selected display, current percentage, apply brightness
- `useHotkeys`: `Ctrl+Alt+Up/Down` registration and brightness step dispatch
- `useWindowPosition`: show/hide, tray placement, drag guard, saved position
- `useStartupOverlay`: startup info visibility and Rust-side blur guard sync

## CURRENT COMPONENT OWNERSHIP

- `TitleBar`: top bar / settings / close actions
- `DeviceNav`: display selector buttons
- `BrightnessSlider`: slider UI only
- `StatusBar`: HDR status presentation only
- `SettingsDialog`: autostart + quit controls
- `AboutDialog`: product copy and shortcuts
- `StartupInfoDialog`: startup discovery overlay

# Frontend - React/TypeScript UI Layer

**Parent:** ./AGENTS.md
**Generated:** 2026-03-29 (refreshed after custom hotkeys and step tuning)

## OVERVIEW

React 18 single-window UI for HDR brightness control. The frontend is split into composition, hooks, services, presentational components, and a small set of Node-based tests for pure logic.

## STRUCTURE

```text
src/
|- App.tsx                    # Composition layer
|- errors.ts                  # User-facing error/notice mapping
|- hotkeys.ts                 # Hotkey normalization, labels, persistence helpers
|- main.tsx                   # React mount + close-to-hide
|- styles.css                 # Shared styling
|- types.ts                   # DisplayInfo, LUMINANCE, HOTKEYS, SLIDER
|- errors.test.ts             # Error mapping tests
|- hotkeys.test.ts            # Hotkey formatting and validation tests
|- types.test.ts              # Pure conversion tests
|- tauriApi.ts                # Compatibility re-export
|- components/
|  |- TitleBar.tsx            # Settings + manual refresh + close
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
|  |- useStartupOverlay.ts
|  |- displayState.ts
|  '- displayState.test.ts
'- services/
   '- tauriApi.ts
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| App wiring | `App.tsx` | Composes hooks and components |
| Display load/apply logic | `hooks/useDisplays.ts` | Source of truth for display state |
| Refresh on show | `hooks/useDisplays.ts` + `App.tsx` | Tray show event refreshes state every time without startup overlay |
| Manual refresh button | `components/TitleBar.tsx` | Refresh control next to settings |
| Wheel brightness | `components/BrightnessSlider.tsx` + `App.tsx` | Mouse wheel over slider adjusts brightness in 2% steps |
| User-facing errors | `errors.ts` + `App.tsx` | Blocking init errors + auto-dismissing notice banner |
| Pure display state helpers | `hooks/displayState.ts` | Selection restore and display update helpers |
| Hotkeys | `hooks/useHotkeys.ts` + `hotkeys.ts` | Customizable global shortcut registration + persistence |
| Window drag/position | `hooks/useWindowPosition.ts` | Tray placement + saved position |
| Startup overlay | `hooks/useStartupOverlay.ts` | Overlay timer + Rust sync |
| Rust bridge | `services/tauriApi.ts` | Typed Tauri calls |

## RULES

- UI components should not call `invoke()` directly
- Keep business logic out of `App.tsx`
- Keep hook responsibilities narrow and explicit
- `types.ts` is the only place for shared frontend constants
- `services/tauriApi.ts` is the only place for typed Rust command wrappers
- Put testable pure logic in helper modules before embedding it in hooks
- Keep user-facing error copy centralized in `errors.ts`

## CURRENT HOOK OWNERSHIP

- `useDisplays`: display list, selected display, current percentage, apply brightness, refresh logic, user notices
- `useHotkeys`: user-configurable global shortcut registration and 4% brightness step dispatch
- `useWindowPosition`: show/hide, tray placement, drag guard, saved position
- `useStartupOverlay`: startup info visibility and Rust-side blur guard sync

## CURRENT TEST COVERAGE

- `types.test.ts`: nits / percentage conversion helpers
- `hooks/displayState.test.ts`: selection restore and targeted display update helpers
- `errors.test.ts`: user-facing error mapping helpers
- `hotkeys.test.ts`: hotkey formatting, normalization, and validation helpers

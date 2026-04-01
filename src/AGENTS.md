# Frontend - React/TypeScript UI Layer

**Parent:** ./AGENTS.md
**Generated:** 2026-03-31 (refreshed)

## OVERVIEW

React 18 single-window UI for HDR brightness control. The frontend is split into composition, hooks, services, presentational components, and a small set of Node-based tests for pure logic.

## STRUCTURE

```text
src/
|- App.tsx                    # Composition layer
|- app/
|  |- useAppController.ts     # App-level lifecycle and dialog control
|  '- useNoticeController.ts  # Notice auto-dismiss lifecycle
|- brightness/
|  '- useBrightnessController.ts # Slider interaction control
|- errors.ts                  # User-facing error/notice mapping
|- hotkeys.ts                 # Hotkey normalization, labels, persistence helpers
|- main.tsx                   # React mount + close-to-hide
|- styles.css                 # Shared styling
|- types.ts                   # DisplayInfo, LUMINANCE, HOTKEYS, SLIDER
|- displayContract.test.ts    # TS/Rust contract checks
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
|  |- useDisplaySelection.ts
|  |- useDisplayDeviceActions.ts
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
| App-level control | `app/useAppController.ts` | Initialization, tray events, autostart, dialogs, quit |
| Brightness interaction control | `brightness/useBrightnessController.ts` | Slider drag, commit, wheel handling |
| Display hook facade | `hooks/useDisplays.ts` | Public display-state hook |
| Display selection state | `hooks/useDisplaySelection.ts` | Selected display, percentage, HDR-active derivation |
| Display device actions | `hooks/useDisplayDeviceActions.ts` | Refresh, brightness apply, HDR toggle |
| Refresh on show | `hooks/useDisplays.ts` + `App.tsx` | Tray show event refreshes state every time without startup overlay |
| Manual refresh button | `components/TitleBar.tsx` | Refresh control next to settings |
| Wheel brightness | `components/BrightnessSlider.tsx` + `App.tsx` | Mouse wheel over slider adjusts brightness in 2% steps |
| HDR toggle | `components/StatusBar.tsx` + `hooks/useDisplays.ts` | Real toggle backed by DisplayConfig advanced color state |
| User-facing errors | `errors.ts` + `App.tsx` | Blocking init errors + auto-dismissing notice banner |
| Pure display state helpers | `hooks/displayState.ts` | Selection restore and display update helpers |
| Hotkeys | `hooks/useHotkeys.ts` + `hotkeys.ts` | Customizable global shortcut registration + persistence |
| Window drag/position | `hooks/useWindowPosition.ts` | Tray placement + saved position |
| Startup overlay | `hooks/useStartupOverlay.ts` | Overlay timer + Rust sync |
| Rust bridge | `services/tauriApi.ts` | Typed Tauri calls |
| TS/Rust contract checks | `displayContract.test.ts` | Detects drift in `DisplayInfo` and luminance constants |

## RULES

- UI components should not call `invoke()` directly
- Keep business logic out of `App.tsx`
- Keep hook responsibilities narrow and explicit
- Keep app lifecycle logic in `useAppController`
- Keep slider interaction logic in `useBrightnessController`
- Keep selection derivation in `useDisplaySelection`
- Keep device command flows in `useDisplayDeviceActions`
- `types.ts` is the only place for shared frontend constants
- `DisplayInfo.hdr_supported` and `DisplayInfo.hdr_enabled` are distinct and must stay aligned with Rust
- `services/tauriApi.ts` is the only place for typed Rust command wrappers
- Put testable pure logic in helper modules before embedding it in hooks
- Keep user-facing error copy centralized in `errors.ts`

## CURRENT HOOK OWNERSHIP

- `useDisplays`: public facade for display list, selected display, refresh, brightness, and HDR actions
- `useDisplaySelection`: selected display, current percentage, and HDR-active derived state
- `useDisplayDeviceActions`: refresh, load, brightness apply, HDR toggle, and notice/error integration
- `useHotkeys`: user-configurable global shortcut registration and 4% brightness step dispatch
- `useWindowPosition`: show/hide, tray placement, drag guard, saved position
- `useStartupOverlay`: startup info visibility and Rust-side blur guard sync

## CURRENT UI RULES

- `StatusBar` toggle is real and must refresh state after a successful HDR change
- SDR brightness controls should remain disabled when `hdr_enabled` is `false`
- The frontend consumes Rust-owned display state results; it should not reintroduce display-state push sync paths

## CURRENT TEST COVERAGE

- `types.test.ts`: nits / percentage conversion helpers
- `displayContract.test.ts`: TypeScript/Rust `DisplayInfo` and luminance contract checks
- `hooks/displayState.test.ts`: selection restore and targeted display update helpers
- `errors.test.ts`: user-facing error mapping helpers
- `hotkeys.test.ts`: hotkey formatting, normalization, and validation helpers

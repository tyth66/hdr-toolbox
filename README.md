# HDR Toolbox

A lightweight Windows system tray application for adjusting HDR monitor SDR content brightness, built with **Rust + Tauri 2 + React**.

## Features

- System tray control
- Left-click tray icon to show or hide the slider window
- Right-click tray icon to open the dynamic device menu
- Customizable global hotkeys for brightness up/down
- Per-display HDR-capable display control with current HDR state awareness
- Live HDR toggle in the status bar
- Auto-start toggle in settings
- Real-time slider updates while dragging
- Keyboard adjustment support on the brightness slider
- Mouse-wheel brightness adjustment while hovering the slider
- Manual refresh button in the title bar, beside the settings button
- Silent display-state refresh every time the window is shown from the tray
- Product-style error handling with auto-dismissing notice banners for non-blocking failures
- Refined in-app wording for clearer HDR state, empty-state, and settings copy

## Requirements

- Windows 10/11
- HDR-capable monitor
- HDR can be off initially; the app can detect HDR-capable displays and turn HDR on per display

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run build
npm run tauri build
```

## Test

```bash
npm test
```

This runs:

- frontend Node-based tests for pure TypeScript logic
- Rust unit tests for display service helpers

Output binary:

```text
src-tauri/target/release/hdr-toolbox.exe
```

## Architecture

### Frontend

```text
src/
|- App.tsx
|- app/
|  |- useAppController.ts
|  '- useNoticeController.ts
|- brightness/
|  '- useBrightnessController.ts
|- hotkeys.ts
|- components/
|- hooks/
|  |- useDisplaySelection.ts
|  |- useDisplayDeviceActions.ts
|  |- useDisplays.ts
|  |- useHotkeys.ts
|  |- useWindowPosition.ts
|  |- useStartupOverlay.ts
|  |- displayState.ts
|  '- displayState.test.ts
|- services/
|  '- tauriApi.ts
|- displayContract.test.ts
|- errors.test.ts
|- hotkeys.test.ts
|- types.ts
|- types.test.ts
'- errors.ts
```

- `App.tsx`: thin composition layer
- `app/`: app-level controllers for initialization, dialogs, autostart, and notices
- `brightness/`: slider interaction controller
- `hotkeys.ts`: shortcut normalization, persistence, and user-facing labels
- `components/`: presentational UI
- `hooks/useDisplays.ts`: public display-state hook facade
- `hooks/useDisplaySelection.ts`: selected-display and derived percentage state
- `hooks/useDisplayDeviceActions.ts`: refresh, brightness apply, and HDR toggle flows
- `services/tauriApi.ts`: typed Rust command wrappers
- `displayContract.test.ts`: source-based TypeScript/Rust contract checks
- `errors.test.ts`: user-facing error mapping regression checks
- `*.test.ts`: frontend logic and contract tests

### Backend

```text
src-tauri/src/
|- lib.rs
|- app/
|  |- mod.rs
|  |- state.rs
|  |- commands.rs
|  '- window.rs
|- tray.rs
'- display/
   |- model.rs
   |- ffi.rs
   |- service.rs
   '- commands.rs
```

- `app/state.rs`: shared `AppState` plus tray summary state
- `app/commands.rs`: app-level commands such as tray rect, startup overlay guard, dragging guard, and quit
- `app/window.rs`: Mica and blur-to-hide window behavior
- `display/ffi.rs`: raw Windows DisplayConfig / MCCS calls
- `display/service.rs`: HDR-capable display enumeration, failure-state logic, and brightness logic
- `display/service.rs`: HDR-capable display enumeration, HDR state polling after toggle, failure-state logic, and brightness logic
- `display/commands.rs`: Tauri command boundary plus Rust-owned display-state updates
- `tray.rs`: tray icon, tooltip, and menu events backed by tray summary state

## Important Notes

- SDR white level range is fixed to **80-480 nits**
- The app controls **SDR White Level**, not monitor OSD backlight brightness
- MCCS brightness is queried only as informational metadata
- The SDR white level SET path relies on undocumented Windows device info type `0xFFFFFFEE`
- The custom SET struct requires `final_value = 1`
- Display enumeration now returns HDR-capable displays even if HDR is currently off
- `DisplayInfo` tracks both `hdr_supported` and `hdr_enabled`
- HDR toggle uses `DISPLAYCONFIG_SET_ADVANCED_COLOR_STATE`
- HDR toggle now polls display state briefly after a write so the frontend receives the settled HDR state
- Rust now owns the authoritative display state; the frontend consumes command results instead of pushing display state back into Tauri
- Tray rendering now uses a Rust-side summary model instead of depending directly on full `DisplayInfo`
- The title bar refresh button triggers a manual display rescan
- Showing the window from the tray performs a silent state refresh every time, without replaying the startup overlay
- Global hotkeys are configurable in Settings and adjust brightness in `4%` steps
- Keyboard adjustments on the brightness slider now commit actual brightness changes instead of only updating the local preview
- Scrolling the mouse wheel over the brightness slider adjusts brightness in `2%` steps
- SDR brightness controls are disabled while HDR is off
- The UI now uses simplified user-facing labels such as `HDR On` / `HDR Ready` and `No HDR-capable displays found`
- Non-blocking failures show a notice banner that auto-dismisses after 5 seconds; initialization failures remain blocking
- `npm test` now also validates the TypeScript/Rust `DisplayInfo` contract, shared luminance constants, and error-message mappings

## License

MIT

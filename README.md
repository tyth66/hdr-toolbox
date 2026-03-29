# HDR Toolbox

A lightweight Windows system tray application for adjusting HDR monitor SDR content brightness, built with **Rust + Tauri 2 + React**.

## Features

- System tray control
- Left-click tray icon to show or hide the slider window
- Right-click tray icon to open the dynamic device menu
- Customizable global hotkeys for brightness up/down
- Per-display HDR brightness control
- Auto-start toggle in settings
- Real-time slider updates while dragging
- Mouse-wheel brightness adjustment while hovering the slider
- Manual refresh button in the title bar, beside the settings button
- Silent display-state refresh every time the window is shown from the tray
- Product-style error handling with auto-dismissing notice banners for non-blocking failures

## Requirements

- Windows 10/11
- HDR-capable monitor
- HDR enabled in Windows Settings

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
|- hotkeys.ts
|- components/
|- hooks/
|- services/
|- hotkeys.test.ts
|- types.ts
|- types.test.ts
'- hooks/displayState.test.ts
```

- `App.tsx`: composition layer
- `hotkeys.ts`: shortcut normalization, persistence, and user-facing labels
- `components/`: presentational UI
- `hooks/`: display state, hotkeys, window positioning, startup overlay
- `services/tauriApi.ts`: typed Rust command wrappers
- `*.test.ts`: pure frontend logic tests

### Backend

```text
src-tauri/src/
|- lib.rs
|- tray.rs
'- display/
   |- model.rs
   |- ffi.rs
   |- service.rs
   '- commands.rs
```

- `display/ffi.rs`: raw Windows DisplayConfig / MCCS calls
- `display/service.rs`: HDR enumeration, failure-state logic, and brightness logic
- `display/commands.rs`: Tauri command boundary
- `tray.rs`: tray icon, tooltip, and menu events

## Important Notes

- SDR white level range is fixed to **80-480 nits**
- The app controls **SDR White Level**, not monitor OSD backlight brightness
- MCCS brightness is queried only as informational metadata
- The SDR white level SET path relies on undocumented Windows device info type `0xFFFFFFEE`
- The custom SET struct requires `final_value = 1`
- The title bar refresh button triggers a manual display rescan
- Showing the window from the tray performs a silent state refresh every time, without replaying the startup overlay
- Global hotkeys are configurable in Settings and adjust brightness in `4%` steps
- Scrolling the mouse wheel over the brightness slider adjusts brightness in `2%` steps
- Non-blocking failures show a notice banner that auto-dismisses after 5 seconds; initialization failures remain blocking

## License

MIT

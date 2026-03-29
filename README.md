# HDR Toolbox

A lightweight Windows system tray application for adjusting HDR monitor SDR content brightness, built with **Rust + Tauri 2 + React**.

## Features

- System tray control
- Left-click tray icon to show or hide the slider window
- Right-click tray icon to open the dynamic device menu
- Global hotkeys: `Ctrl+Alt+Up` / `Ctrl+Alt+Down`
- Per-display HDR brightness control
- Auto-start toggle in settings
- Real-time slider updates while dragging

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

Output binary:

```text
src-tauri/target/release/hdr-toolbox.exe
```

## Architecture

### Frontend

```text
src/
|- App.tsx
|- components/
|- hooks/
|- services/
'- types.ts
```

- `App.tsx`: composition layer
- `components/`: presentational UI
- `hooks/`: display state, hotkeys, window positioning, startup overlay
- `services/tauriApi.ts`: typed Rust command wrappers

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
- `display/service.rs`: HDR enumeration and brightness logic
- `display/commands.rs`: Tauri command boundary
- `tray.rs`: tray icon, tooltip, and menu events

## Important Notes

- SDR white level range is fixed to **80-480 nits**
- The app controls **SDR White Level**, not monitor OSD backlight brightness
- MCCS brightness is queried only as informational metadata
- The SDR white level SET path relies on undocumented Windows device info type `0xFFFFFFEE`
- The custom SET struct requires `final_value = 1`

## License

MIT

<!-- BrightBox -->

<div align="center">

# BrightBox

**A lightweight Windows tray app for controlling monitor brightness**

[![Windows](https://img.shields.io/badge/Windows-10%2F11-blue?style=flat-square&logo=windows&logoColor=white)](https://www.microsoft.com/windows)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Rust](https://img.shields.io/badge/Rust-1.70+-orange?style=flat-square&logo=rust&logoColor=white)](https://www.rust-lang.org)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-4K8C6D?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app)

**[中文版 ->](README_zh.md)**

</div>

---

## What It Does

BrightBox lives in the Windows system tray and gives you a compact brightness panel for supported displays. It can adjust HDR SDR white level, external monitor brightness through DDC/CI, and built-in display brightness through Windows when available.

If one physical monitor supports both HDR and DDC/CI brightness, it stays as one display in the app. Turning HDR on or off changes what the slider controls instead of creating duplicate monitor entries.

---

## Features

| Feature | Description |
|---------|-------------|
| 🎚️ Brightness slider | Adjust the selected display from the tray window |
| 🌗 HDR toggle | Turn HDR on or off per supported display |
| 🖥️ Multi-display support | Control each detected display independently |
| 🔗 Sync brightness | Optionally apply one brightness change to all supported displays |
| 📍 Tray control | Left-click to show or hide; right-click for the tray menu |
| ⌨️ Hotkeys | Use customizable brightness shortcuts |
| 🖱️ Mouse wheel | Fine-tune brightness directly on the slider |
| 🚀 Auto-start | Launch automatically when Windows starts |
| 🎨 Light and dark themes | Follow Windows or choose a fixed theme |
| 🧾 Rolling logs | Keep small local logs for troubleshooting |

---

## Requirements

- Windows 10 or Windows 11
- A display with at least one supported brightness control method:
  - HDR SDR white level
  - DDC/CI brightness on an external monitor
  - Windows brightness control on a built-in display

Some monitors expose only part of this functionality. For example, a display may support HDR but not DDC/CI brightness, or DDC/CI brightness but not HDR.

---

## Download

Get the latest release from **[Releases](https://github.com/tyth66/hdr-toolbox/releases)**:

```text
brightbox.exe
```

Run the executable and the app icon will appear in the system tray.

---

## Usage

1. Launch BrightBox.
2. Left-click the tray icon to show or hide the brightness window.
3. Select a display from the side rail.
4. Drag the slider, use the mouse wheel, or press your brightness hotkeys.
5. Use the HDR switch when you want to change HDR mode for the selected display.

When HDR is on, the slider controls SDR white level. When HDR is off and the display supports physical brightness control, the same slider controls monitor brightness instead.

### Refresh Behavior

| Action | What happens | Refresh button spins |
|--------|--------------|----------------------|
| Open from tray | Reads the current state of known displays | No |
| Window gets focus | Reads the current state of known displays | No |
| Click the refresh button | Re-detects displays and brightness controls | Yes |

Use the refresh button after plugging in a monitor, changing display hardware, or when a monitor does not look right in the app. Normal tray wake and window-focus updates are quiet and should not animate the refresh button.

### Hotkeys

| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+Up` | Brightness +4% |
| `Ctrl+Alt+Down` | Brightness -4% |

You can change these shortcuts in Settings.

---

## Settings

| Setting | Description |
|---------|-------------|
| Auto-start | Launch BrightBox when Windows starts |
| Sync all displays | Apply brightness changes to every display with supported brightness control |
| Theme | Follow Windows, or choose light/dark manually |

---

## Notes

- HDR SDR white level is controlled in the 80-480 nit range.
- DDC/CI support depends on the monitor, cable, GPU path, and monitor settings.
- Some monitors require DDC/CI to be enabled in the monitor's on-screen menu.
- Windows, the monitor OSD, and other brightness tools can change the same hardware value. The app refreshes known display state when the tray window is shown or focused.

---

## FAQ

| Question | Answer |
|----------|--------|
| HDR toggle is disabled | The selected display does not report HDR support. Brightness may still work through another supported method. |
| Brightness does not change | The selected monitor may not expose a usable brightness control path, or DDC/CI may be disabled in the monitor menu. |
| I changed brightness somewhere else | Show or focus the app window; it will read the current known display state. Use refresh if the display setup changed. |
| How do I exit? | Right-click the tray icon and choose Quit. |

---

## Build From Source

BrightBox uses Bun for package management, scripts, and frontend tests. Vite remains the frontend dev server and production frontend bundler.

```bash
bun install
bun run tauri dev
bun run tauri build
```

The release executable is created under `src-tauri/target/release/`.

---

## License

MIT License. See [LICENSE](LICENSE) for details.

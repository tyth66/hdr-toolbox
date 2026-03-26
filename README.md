# HDR Toolbox

A lightweight Windows system tray application for quickly adjusting HDR monitor SDR content brightness, built with **Rust + Tauri**.

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎛️ **System Tray Control** | Always running in the system tray |
| 🖱️ **Left-click** | Toggle brightness slider window |
| 🖱️ **Right-click** | Show context menu with dynamic device list |
| ⌨️ **Global Hotkeys** | `Ctrl+Alt+↑/↓` to increase/decrease brightness by 40 nits |
| 🖥️ **Multi-Monitor** | Independent control for each HDR display |
| 🚀 **Auto-start** | Optional Windows startup registration |
| 💡 **Real-time Slider** | Dragging the slider applies brightness immediately |

## 📋 System Requirements

- Windows 10/11
- HDR-capable monitor with HDR enabled in Windows Settings
- ~5 MB disk space

## 🚀 Quick Start

### Pre-built Release

Download the latest `.exe` from the `src-tauri/target/release/` directory.

### Build from Source

#### Prerequisites

- **Rust** 1.77+ ([rustup](https://rustup.rs/))
- **Node.js** 18+ ([nodejs.org](https://nodejs.org/))
- **Visual Studio** Build Tools with C++ workload

#### Build Steps

```bash
# Install frontend dependencies
npm install

# Development mode
npm run tauri dev

# Production build
npm run tauri build
```

The compiled binary is at:
```
src-tauri/target/release/hdr-toolbox.exe
```

## 🎮 Usage

### Controls

| Action | Input |
|--------|-------|
| Show/hide slider | Left-click tray icon |
| Open menu | Right-click tray icon |
| Switch display from tray | Right-click → select a display |
| Increase brightness | `Ctrl+Alt+↑` (+40 nits) |
| Decrease brightness | `Ctrl+Alt+↓` (-40 nits) |
| Apply to all HDR monitors | Click "Apply All" button |
| Hide on blur | Clicking outside window hides it |

### Startup Behavior

On first launch, the app shows a notification listing all detected HDR displays and their current brightness levels. The window auto-hides after 4 seconds. The slider window also auto-hides when it loses focus (blur). The system tray tooltip always shows the current brightness of the active display.

### Brightness Range

- **Minimum**: 80 nits
- **Maximum**: 480 nits
- **Step**: 40 nits (API requirement: values must be multiples of 4)

## 🏗️ Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| UI Framework | Tauri 2.x (WebView2) |
| Frontend | React 18 + TypeScript + Vite |
| Backend | Rust |
| Windows API | `windows-rs` crate + raw FFI |
| System Tray | Tauri built-in `tray-icon` |
| Global Shortcuts | `tauri-plugin-global-shortcut` |
| Auto-start | `tauri-plugin-autostart` |

### Key Files

```
src-tauri/
├── src/
│   ├── main.rs          # Entry point
│   ├── lib.rs           # Tauri builder + plugin setup
│   ├── display.rs       # DisplayConfig API (HDR GET/SET)
│   └── tray.rs         # System tray (tray managed in Rust, not via tauri.conf.json)
src/
├── App.tsx              # React slider UI
└── main.tsx            # Tauri event listeners
```

### Core Implementation

The core HDR brightness control uses Windows DisplayConfig API:

```rust
// Read SDR white level (documented API)
DisplayConfigGetDeviceInfo(&mut sdr_info.header);

// Set SDR white level (undocumented API)
DisplayConfigSetDeviceInfo(&mut set_params.header);
```

**Important**: `DISPLAYCONFIG_DEVICE_INFO_SET_SDR_WHITE_LEVEL` (`0xFFFFFFEE`) is **undocumented** by Microsoft. The SET operation requires a 3-field struct (vs 2 fields for GET), with an extra `finalValue` field that **must be set to 1** for brightness changes to take effect. Using the documented GET struct for SET operations will silently fail.

## 🔧 Configuration

No configuration file required. Settings are applied immediately.

## 📄 License

MIT License — see [LICENSE](LICENSE)

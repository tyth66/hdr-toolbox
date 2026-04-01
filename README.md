<!-- HDR Toolbox -->

<div align="center">

# HDR Toolbox

**A lightweight Windows system tray app for adjusting HDR monitor SDR brightness**

[![Windows](https://img.shields.io/badge/Windows-10%2F11-blue?style=flat-square&logo=windows&logoColor=white)](https://www.microsoft.com/windows)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Rust](https://img.shields.io/badge/Rust-1.70+-orange?style=flat-square&logo=rust&logoColor=white)](https://www.rust-lang.org)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-4K8C6D?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app)

**[中文版 →](README_zh.md)**

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎚️ **Brightness Slider** | Real-time SDR white level adjustment (80-480 nits) |
| 🌗 **HDR Toggle** | One-click HDR mode on/off |
| ⌨️ **Global Hotkeys** | Customizable shortcuts (default `Win+Alt+↑/↓`) |
| 🖱️ **Mouse Wheel** | Fine-tune with 2% steps on slider |
| 🖥️ **Multi-Display** | Independent control per monitor |
| ⚡ **Silent Refresh** | Auto-sync state when waking from tray |
| 🔄 **Manual Refresh** | Re-detect displays via title bar |
| 🚀 **Auto-start** | Launch on system boot (optional) |
| 📍 **Tray Control** | Left-click show/hide, right-click menu |

---

## 📋 Requirements

- **OS:** Windows 10 or Windows 11
- **Display:** HDR-capable monitor
- **Note:** HDR can be off initially — the app detects HDR displays and enables HDR per-display

---

## 🚀 Quick Start

### Download

Get the latest release from **[Releases](https://github.com/your-repo/hdr-toolbox/releases)**:

```
hdr-toolbox.exe
```

### Build from Source

```bash
# Clone the repository
git clone https://github.com/your-repo/hdr-toolbox.git
cd hdr-toolbox

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

> **Output:** `src-tauri/target/release/hdr-toolbox.exe`

---

## 📖 Usage

```
1. Launch the app → icon appears in system tray
2. Left-click tray icon → show/hide brightness window
3. Right-click tray icon → open device menu
4. Drag slider or use wheel/keyboard to adjust brightness
5. Click HDR toggle in status bar to enable/disable HDR
```

### ⌨️ Hotkeys

| Shortcut | Action |
|----------|--------|
| `Win+Alt+↑` | Brightness +4% |
| `Win+Alt+↓` | Brightness -4% |
| `Win+Alt+H` | Toggle HDR |

> Customize hotkeys in **Settings**

---

## ⚙️ Configuration

| Setting | Description |
|---------|-------------|
| **Auto-start** | Enable/disable in Settings |
| **Brightness Range** | Fixed at **80-480 nits** |

> ℹ️ This app controls **SDR White Level** (Windows display adapter), not monitor OSD backlight brightness.

---

## ❓ FAQ

| Question | Answer |
|----------|--------|
| **HDR toggle is grayed out** | Ensure monitor is connected and supports HDR. Click the refresh button. |
| **Adjustments have no effect** | Some monitors may not support this control path. |
| **How to exit** | Right-click tray icon → **Quit** |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 · TypeScript · Vite |
| Backend | Rust · Tauri 2 |
| System API | Windows DisplayConfig API |

---

## 📄 License

MIT License · see [LICENSE](LICENSE) for details

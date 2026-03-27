# HDR Toolbox — Knowledge Base

**Generated:** 2026-03-27
**Type:** Rust + Tauri 2 (Windows desktop app)

## Overview

Windows system tray app for HDR monitor control — SDR brightness adjustment via DisplayConfig API, hotkeys, auto-start. Rust backend + React/TypeScript frontend bundled by Tauri.

## Structure

```
./
├── src/                      # React frontend (UI layer)
│   ├── App.tsx              # Slider UI, device selector, hotkey handlers
│   ├── main.tsx             # Tauri event listeners
│   └── styles.css           # Plain CSS, no preprocessor
├── src-tauri/
│   ├── src/
│   │   ├── main.rs          # Entry: calls lib::run()
│   │   ├── lib.rs           # Tauri builder, plugin setup, generate_handler!
│   │   ├── display.rs       # Core: DisplayConfig GET/SET HDR brightness (272 lines)
│   │   └── tray.rs         # System tray (left/right click, menu) (217 lines)
│   ├── Cargo.toml           # Tauri 2, windows-rs 0.62, window-vibrancy (Mica)
│   └── tauri.conf.json      # Window config, bundle settings (tray managed in Rust)
├── package.json              # Vite + React + Tauri CLI
├── vite.config.ts
└── tsconfig.json
```

## Code Map

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `HDR_INFO_DISABLED` | static | display.rs:18 | Atomic kill switch on repeated failures |
| `DisplayInfo` | struct | display.rs:22 | Serde-serializable HDR display descriptor |
| `get_sdr_white_level_raw` | fn | display.rs:44 | FFI call: GET SDR white level |
| `DISPLAYCONFIG_SET_SDR_WHITE_LEVEL` | struct | display.rs:75 | Undocumented SET struct (3 fields, not in windows-rs) |
| `set_sdr_white_level_raw` | fn | display.rs:82 | FFI call: SET SDR white level |
| `get_hdr_displays` | fn | display.rs:118 | Tauri command: enumerate HDR monitors |
| `set_brightness` | fn | display.rs:246 | Tauri command: set brightness for 1 display |
| `set_brightness_all` | fn | display.rs:261 | Tauri command: broadcast to all displays |
| `AppState` | struct | lib.rs:12 | Shared state holding display list for tray menu |
| `update_displays_and_tooltip` | fn | lib.rs:30 | Cache displays + update tray tooltip |
| `get_cached_displays` | fn | lib.rs:42 | Get cached display list for tray menu |
| `build_full_menu` | fn | tray.rs:37 | Build dynamic tray menu with device list |
| `update_tray_tooltip` | fn | tray.rs:87 | Update tray tooltip with display name/nits |
| `update_tray_menu` | fn | tray.rs:110 | Rebuild and set tray menu before right-click |
| `handle_tray_click` | fn | tray.rs:137 | Left/right click on tray |
| `handle_menu_event` | fn | tray.rs:171 | Tray menu item clicks |
| `setup_tray` | fn | tray.rs:203 | Build tray icon with embedded icon (include_bytes!) |

## Key Conventions

### Rust

- **Edition 2021**, MSRV not pinned (Tauri 2 requires 1.77+)
- **Error handling**: `Result<T, String>` for Tauri commands, raw `WIN32_ERROR` for FFI
- **Logging**: `tracing` + `tracing-subscriber` with `fmt` and `env-filter`, `INFO` level
- **Serde**: `#[derive(Serialize, Deserialize)]` only on `DisplayInfo`
- **Static init**: `once_cell::Lazy` for `HDR_INFO_DISABLED`
- **No `anyhow`/`thiserror`** — plain `Result<T, String>` everywhere
- **DisplayConfig types**: Import from `windows::Win32::Devices::Display`, LUID from `Win32::Foundation`
- **Manual FFI SET struct**: `DISPLAYCONFIG_SET_SDR_WHITE_LEVEL` — NOT in windows-rs, defined with `#[repr(C)]` with 3 fields (header, SDRWhiteLevel, finalValue=1)
- **FFI pointer casts**: All DisplayConfig calls cast header via `as *mut _ as *mut windows::...::DISPLAYCONFIG_DEVICE_INFO_HEADER`
- **Release profile**: `panic = "abort"`, `codegen-units = 1`, `lto = true`, `opt-level = "z"`, `strip = true`
- **Windows features**: `Win32_Foundation`, `Win32_Graphics_Gdi`, `Win32_UI_Shell`, `Win32_UI_WindowsAndMessaging`, `Win32_Devices_Display` (no `Win32_System_Registry` — unused)

### Frontend

- **React 18** with hooks only (`useState`, `useEffect`, `useCallback`)
- **Plain CSS** — no preprocessor, CSS variables for slider progress
- **Tauri JS APIs**: `invoke()` for commands, `listen()` for events, `register()` for shortcuts
- **No router** — single-window app, shown/hidden via tray
- **`displayInfo` passed by value** to `set_brightness_all` — deserialized from JSON

### Tauri 2

- **`tray-icon` + `image-png`** features enabled (not plugins — built into tauri; `image-png` required for `Image::from_bytes` with PNG data)
- **`devtools` NOT enabled** — removed for production performance (WebView2 overhead)
- **Global shortcut/autostart** via `tauri-plugin-*` crates
- **Plugins registered in `lib.rs`** via `.plugin(...)`
- **Tray menu items** rebuilt dynamically for autostart checkmark
- **Events emitted** to JS: `"show-about"`, `"toggle-autostart"`, `"select-display"`
- **JS-side shortcut registration** via `@tauri-apps/plugin-global-shortcut`
- **JS-side window events**: `blur` listener for blur-to-hide (matches original C++ `WM_ACTIVATE` + `WA_INACTIVE`)
- **Window**: 300×200, `decorations: false` (custom title bar), `transparent: true`, `skipTaskbar`, `alwaysOnTop`, `minimizable: false`, `maximizable: false`, starts hidden
- **Mica backdrop**: Applied via `window-vibrancy` crate in `lib.rs` setup — Windows 11 only, requires transparency enabled in Windows Settings

## Anti-Patterns (This Project)

- **NEVER use `app.global_shortcut()`** — it returns `&GlobalShortcut`, not `GlobalShortcut`. Use plugin JS API instead.
- **NEVER use `AutostartExt`** — doesn't exist in tauri-plugin-autostart 2.x. Autostart handled in JS via `enable()`/`disable()`.
- **NEVER use `WIN32_ERROR(0)` with `!=`** — `WIN32_ERROR` is `i32`. Compare directly: `result != 0`.
- **NEVER cast FFI results via `.0`** on WIN32_ERROR — use directly or `{:?}` formatting.
- **NEVER use `menu.popup_menu()`** — doesn't exist on `TrayIcon`. Omit; menu auto-shows on right-click.
- **NEVER use `DISPLAYCONFIG_SDR_WHITE_LEVEL` for SET operations** — the documented GET struct has 2 fields, but the undocumented SET version has 3 fields including `finalValue` which must be `1`. Define a custom struct with `#[repr(C)]`.

## Commands

```bash
# Development
npm run tauri dev

# Production build
npm run tauri build

# Frontend only
npm run build

# Rust check
cd src-tauri && cargo check
```

## Notes

- HDR detection: skips non-HDR monitors (checked via `DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO`, bit 0x2)
- Brightness range: 80–480 nits, clamped to multiples of 4
- Nits↔API value: `api = nits * 1000 / 80`, `nits = api * 80 / 1000`
- `display.rs` has `HDR_INFO_DISABLED` atomic kill switch — once `QueryDisplayConfig` fails, all subsequent calls return error until restart
- **Critical bugfix**: The undocumented `DISPLAYCONFIG_DEVICE_INFO_SET_SDR_WHITE_LEVEL` (0xFFFFFFEE) requires a 3-field struct with `finalValue = 1`, otherwise brightness changes are silently ignored by the OS.
- Single-instance: default Tauri behavior (second instance blocked)
- **Dead code**: `hotkey.rs` was planned but never created — referenced in docs but does not exist
- **Tray tooltip**: Dynamically updated via `update_tray_tooltip()` on every brightness change
- **Startup notification**: Shows detected HDR displays in a brief overlay on first launch, then auto-hides
- **Blur-to-hide**: Slider window hides on `blur` event, matching original C++ `WM_ACTIVATE` + `WA_INACTIVE` behavior
- **Close-to-hide**: Custom title bar close button calls `window.hide()` (not standard decorations)
- **Tray menu**: No initial menu on tray icon creation; `update_tray_menu()` pre-builds and sets menu when displays are loaded; Windows automatically shows the pre-set menu on right-click. Dynamic device list rebuilt on every `update_displays_and_tooltip` call.
- **select-display event**: Switching active display in tray menu switches display in JS UI
- **Windows 11 Mica UI**: Custom frameless window with Mica backdrop, glass-morphism UI, light/dark mode via `prefers-color-scheme`

## Build & CI

- **No CI/CD**: Manual builds only (`npm run tauri build`)
- **No tests**: Project has zero test files, no test dependencies, no test scripts

## Optimization Notes

See `issue.md` for pending performance optimizations and known issues.

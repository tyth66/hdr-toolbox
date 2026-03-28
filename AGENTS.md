# HDR Toolbox — Knowledge Base

**Generated:** 2026-03-28 (refreshed)
**Type:** Rust + Tauri 2 (Windows desktop app)

## OVERVIEW

Windows system tray app for HDR monitor SDR brightness control via Windows DisplayConfig API. Rust FFI backend + React/TypeScript frontend bundled by Tauri 2.

## STRUCTURE

```
./
├── src/                      # React 18 frontend (UI layer)
│   ├── App.tsx              # Slider UI, device selector, hotkeys (684 lines)
│   ├── main.tsx             # Tauri event listeners, close-to-hide
│   └── styles.css           # Windows 11 Mica design, glass-morphism
├── src-tauri/
│   ├── src/
│   │   ├── main.rs          # Binary entry: calls lib::run()
│   │   ├── lib.rs           # Tauri builder, plugin setup, AppState (162 lines)
│   │   ├── display.rs       # DisplayConfig FFI: GET/SET SDR white level + MCCS (488 lines)
│   │   └── tray.rs         # System tray: icon, menu, click handlers (189 lines)
│   ├── Cargo.toml           # Tauri 2, windows-rs 0.62, window-vibrancy
│   └── tauri.conf.json      # Window: 300×200, frameless, transparent, skipTaskbar
├── package.json              # Vite + React 18 + Tauri CLI
├── vite.config.ts           # Vite config with manualChunks (vendor/tauri)
└── tsconfig.json            # Strict mode, ES2020, JSX react-jsx
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| DisplayConfig FFI | `src-tauri/src/display.rs` | Undocumented SET_SDR_WHITE_LEVEL struct |
| Tray management | `src-tauri/src/tray.rs` | Dynamic menu, pre-set before right-click |
| Window blur-to-hide | `src-tauri/src/lib.rs` | `on_window_event` in setup |
| Slider UI + state | `src/App.tsx` | Ref sync pattern for async listeners |
| Hotkey registration | `src/App.tsx` | JS-side via `@tauri-apps/plugin-global-shortcut` |

## CODE MAP

| Symbol | Type | Location | Role |
|--------|------|----------|------|
| `HDR_INFO_DISABLED` | static | display.rs:23 | Atomic kill switch |
| `HDR_CONSECUTIVE_FAILURES` | static | display.rs:25 | Atomic failure counter |
| `DisplayInfo` | struct | display.rs:29 | Serde-serializable HDR display with min/max percentage (MCCS) |
| `DISPLAYCONFIG_SET_SDR_WHITE_LEVEL` | struct | display.rs:78 | Custom `#[repr(C)]` 3-field SET struct |
| `get_brightness_range_from_physical_monitor` | fn | display.rs:62 | MCCS GetMonitorBrightness wrapper |
| `get_hmonitor_for_display` | fn | display.rs:111 | Get HMONITOR from LUID/target |
| `get_hdr_displays` | fn | display.rs:280 | Tauri command: enumerate HDR monitors |
| `set_brightness` | fn | display.rs:446 | Tauri command: set 1 display (percentage-based) |
| `set_brightness_all` | fn | display.rs:467 | Tauri command: broadcast all |
| `AppState` | struct | lib.rs:14 | Mutex<Vec<DisplayInfo>> + startup_info_active + is_dragging |
| `update_displays_and_tooltip` | fn | lib.rs:35 | Cache + update tray |
| `set_dragging_mode` | fn | lib.rs:70 | Tauri command: set is_dragging flag |
| `build_full_menu` | fn | tray.rs:14 | Dynamic tray menu with device list + Quit |
| `handle_tray_click` | fn | tray.rs:103 | Left/right tray click |
| `setup_tray` | fn | tray.rs:175 | TrayIcon from embedded PNG bytes |
| `TRAY_ID` | const | tray.rs:11 | `"main-tray"` |

## CONVENTIONS

### Rust
- **Error handling**: `Result<T, String>` for Tauri cmds; raw `WIN32_ERROR` for FFI
- **No `anyhow`/`thiserror`**
- **Logging**: `tracing` + `tracing-subscriber`, `INFO` level
- **Serde**: `#[derive(Serialize, Deserialize)]` only on `DisplayInfo`
- **Static init**: `once_cell::Lazy` for `HDR_INFO_DISABLED`
- **Windows FFI**: Import from `windows::Win32::Devices::Display` + `Win32::Foundation::LUID`
- **Windows features**: `Win32_Foundation`, `Win32_Graphics_Gdi`, `Win32_UI_Shell`, `Win32_UI_WindowsAndMessaging`, `Win32_Devices_Display`
- **Release profile**: `panic = "abort"`, `codegen-units = 1`, `lto = true`, `opt-level = "z"`, `strip = true`

### Frontend
- **React 18**: Hooks only (`useState`, `useEffect`, `useCallback`, `useRef`)
- **Plain CSS**: No preprocessor, CSS variables, `prefers-color-scheme`
- **Tauri JS**: `invoke()` for commands, `listen()` for events
- **No router**: Single window, show/hide via tray
- **Ref sync**: `displaysRef.current` kept in sync with `displays` state for async listeners

### Tauri 2
- **`tray-icon` + `image-png`** features (built-in, not plugins)
- **`devtools` disabled** in production
- **Plugins**: global-shortcut (JS reg), autostart (JS `enable()`/`disable()`)
- **Window**: 300×200, `decorations: false`, `transparent: true`, `alwaysOnTop`, starts hidden
- **Mica backdrop**: `window-vibrancy::apply_mica` in `lib.rs` setup (Windows 11 only)

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER use `app.global_shortcut()`** — use JS plugin API instead
- **NEVER use `AutostartExt`** — use JS `enable()`/`disable()` from `@tauri-apps/plugin-autostart`
- **NEVER use `WIN32_ERROR(0) with !=`** — `WIN32_ERROR` is `i32`; compare directly: `result != 0`
- **NEVER cast FFI results via `.0`** on `WIN32_ERROR`
- **NEVER use `menu.popup_menu()`** — menu auto-shows on right-click; call `set_menu` BEFORE click
- **NEVER use `DISPLAYCONFIG_SDR_WHITE_LEVEL` for SET** — SET requires custom 3-field `#[repr(C)]` struct with `finalValue = 1`
- **NEVER use `tauri://blur`** — unreliable for frameless windows; use Rust `on_window_event`

## COMMANDS

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

## NOTES

- **Brightness range**: UI slider 0-100% (matching Windows), converted to nits via fixed range (80-480 nits) for DisplayConfig API. MCCS `GetMonitorBrightness` is called to get actual monitor min/max percentages, stored in `DisplayInfo.min_percentage`/`max_percentage` (currently informational only, falls back to 0-100).
- **MCCS vs SDR White Level**: MCCS `GetMonitorBrightness` returns **backlight brightness** (OSD control, 0-100%), NOT SDR White Level brightness. These are different concepts. MCCS controls the monitor's internal backlight, while SDR White Level controls Windows HDR metadata brightness mapping (80-480 nits).
- **Luminance acquisition**: See section "LUMINANCE ACQUISITION" for details on reading monitor brightness range, including the planned DXGI migration.
- **Nits↔API**: `api = nits * 1000 / 80`, `nits = api * 80 / 1000`
- **HDR detection**: Uses `DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO` bit 0x2
- **Kill switch**: `HDR_INFO_DISABLED` atomic — disables after 3 consecutive failures; success resets counter
- **Critical SET bugfix**: `DISPLAYCONFIG_DEVICE_INFO_SET_SDR_WHITE_LEVEL` (`0xFFFFFFEE`) needs 3-field struct with `finalValue = 1` — SET silently fails otherwise
- **Tray tooltip**: Updated on every brightness change via `update_tray_tooltip_only`
- **Blur-to-hide**: Rust `on_window_event(Focused(false))` hides window unless `startup_info_active` or `is_dragging` flag is true
- **Close-to-hide**: Custom close button calls `window.hide()` (not `window.close()`)
- **Quit**: Tray menu Quit or Settings overlay Quit calls `invoke("quit")` → `app.exit(0)` in Rust (bypasses close-to-hide)
- **Tray menu pattern**: Pre-build menu via `update_tray_menu()` after display load; Windows auto-shows on right-click. Menu always contains Quit button even when no HDR displays. Settings/About remain in the settings overlay.
- **Error cache sync**: When `get_hdr_displays` fails, `catch` block calls `update_displays_and_tooltip({ displays: [] })` to sync empty state to Rust tray menu.
- **Startup overlay**: Shows detected HDR displays for 4s then auto-dismisses (info overlay only, main window stays); `startup_info_active` flag prevents blur-to-hide during this window
- **Drag-to-hide fix**: `set_dragging_mode` command sets `is_dragging` flag; JS clears it 200ms after `startDragging()` to handle click-without-drag
- **Dead code**: `hotkey.rs` was planned but never created

## LUMINANCE ACQUISITION

### Overview

Reads monitor brightness range (nits) to replace hardcoded 80-480 nits fallback. Used by `set_brightness` to convert UI percentage → actual nits.

**Important**: MCCS `GetMonitorBrightness` returns **backlight brightness** (OSD control), NOT SDR White Level brightness:
- MCCS: Controls monitor's internal backlight (0-100% via DDC/CI)
- SDR White Level: Controls Windows HDR metadata brightness mapping (80-480 nits)

### Current Implementation: WinRT DisplayMonitor EDID

**Status**: Implemented (WinRT)

**API flow**:
```
DisplayMonitor::GetDeviceSelector() → DeviceInformation::FindAllAsyncAqsFilter() → 
DisplayMonitor::FromIdAsync() → MinLuminanceInNits() / MaxLuminanceInNits()
```

**Data structure**: `DisplayInfo` includes `min_nits: Option<u32>`, `max_nits: Option<u32>`

**Device matching**: By display name string (DisplayConfig) ↔ (WinRT)

**Fallback**: If EDID unavailable → 80-480 nits

**Frontend**: `set_brightness` calls use `display.min_nits ?? 80` / `display.max_nits ?? 480`

**Cargo.toml features**: `Devices_Display`, `Devices_Enumeration`, `Foundation`, `Foundation_Collections`, `windows-future = "0.3"`

### Planned Migration: DXGI IDXGIOutput6

**Status**: Planned (replaces WinRT EDID)

**Why DXGI instead of EDID**: EDID data is sourced from the monitor's firmware (vendor-stated values) and can be inaccurate, vendor-inflated, or missing entirely. DXGI returns the actual HDR metadata that the Windows HDR pipeline uses, reflecting real display behavior.

**API flow**:
```
CreateDXGIFactory1() → EnumAdapters1() → EnumOutputs() → 
QueryInterface → IDXGIOutput6 → GetDesc1()
```

**Data returned**:
| Field | Meaning |
|-------|---------|
| `MinLuminance` | Black level (nits) |
| `MaxLuminance` | Peak brightness (nits) |
| `MaxFullFrameLuminance` | Full-frame max (similar to MaxFALL) |
| `ColorSpace` | HDR判断: `DXGI_COLOR_SPACE_RGB_FULL_G2084_NONE_P2020` = HDR10 |

**Device matching**: By adapter LUID + output index (more reliable than string name matching)

**Fallback chain**:
```
DXGI (primary)
    ↓ fail / invalid
EDID WinRT (secondary)
    ↓ fail
80-480 nits (final fallback)
```

**Required Cargo.toml features** (new):
```toml
"Win32_Graphics_Dxgi",
"Win32_Graphics_Dxgi_Common",
```

**Risks & Mitigations**:
| Risk | Mitigation |
|------|------------|
| HDR not enabled in Windows | Fallback to EDID or 80-480 |
| HDMI without metadata | Fallback; suggest DisplayPort |
| GPU < WDDM 2.4 | Fallback to EDID or 80-480 |
| `max_nits <= 0` (HDMI issue) | Treat as fallback |
| `max_nits > 2000` (vendor inflation) | Clamp to 1000 nits |

### Risks & Limitations (Current WinRT Implementation)

- **Device name matching**: May fail if DisplayConfig name differs from WinRT device name
- **Display support**: EDID luminance data not available on all monitors
- **Driver dependency**: GPU driver must report EDID luminance correctly
- **EDID inaccuracy**: Vendor-stated values may not reflect actual HDR behavior

## BUILD & CI

- **No CI/CD**: Manual builds only
- **No tests**: Zero test files

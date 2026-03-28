# Rust Backend — Tauri 2 Core

**Parent:** ./AGENTS.md (root)

**Generated:** 2026-03-28 (refreshed)

## OVERVIEW

Windows DisplayConfig API bindings via `windows-rs`. Low-level FFI + Tauri command layer for HDR brightness control. 4 modules, 827 lines Rust.

## STRUCTURE

```
src-tauri/src/
├── main.rs              # Binary entry (8 lines): calls hdr_toolbox_lib::run()
├── lib.rs               # Tauri builder, plugin setup, AppState (162 lines)
├── display.rs           # DisplayConfig FFI: GET/SET SDR white level + luminance (EDID→DXGI planned) (511 lines)
└── tray.rs             # System tray: icon, menu, click handlers (189 lines)
                          # (hotkey.rs: planned but never created)
```

## MODULE HIERARCHY

```
main.rs → lib.rs (pub fn run())
     ├─→ display (pub mod display)
     │    └─ get_hdr_displays, set_brightness, set_brightness_all (tauri::command)
     └─→ tray (pub mod tray)
          └─ setup_tray, update_tray_menu, update_tray_tooltip, handle_tray_click, handle_menu_event
```

## KEY DATA STRUCTURES

| Symbol | File:Line | Notes |
|--------|-----------|-------|
| `DisplayInfo` | display.rs:22 | Serde-serializable HDR display descriptor (luminance via EDID, DXGI migration planned) |
| `AppState` | lib.rs:14 | `Mutex<Vec<DisplayInfo>>` + `Mutex<bool>` (startup_info_active) |
| `HDR_INFO_DISABLED` | display.rs:18 | `Lazy<AtomicBool>` kill switch — disables after 3 consecutive failures, resets on success |
| `HDR_CONSECUTIVE_FAILURES` | display.rs:20 | `Lazy<AtomicUsize>` consecutive failure counter |
| `DISPLAYCONFIG_SET_SDR_WHITE_LEVEL` | display.rs:78 | Custom `#[repr(C)]` 3-field struct (undocumented SET) |
| `TRAY_ID` | tray.rs:11 | `"main-tray"` |

## FFI PATTERN (display.rs)

```rust
// Unsafe pointer cast pattern — MUST use `as *mut _ as *mut _`
DisplayConfigGetDeviceInfo(header as *mut _ as *mut DISPLAYCONFIG_DEVICE_INFO_HEADER)

// SET: 3-field custom struct with finalValue = 1
#[repr(C)]
struct DISPLAYCONFIG_SET_SDR_WHITE_LEVEL {
    header: DISPLAYCONFIG_DEVICE_INFO_HEADER,
    sdrwhite_level: u32,
    final_value: u8, // MUST be 1
}

// GET: 2-field windows-rs struct
DISPLAYCONFIG_SDR_WHITE_LEVEL { header, SDRWhiteLevel }
```

**Critical**: SET uses undocumented `DISPLAYCONFIG_DEVICE_INFO_TYPE(0xFFFFFFEE)` — NOT the documented GET type.

## COMMANDS EXPOSED TO JS

| Command | Returns | Notes |
|---------|---------|-------|
| `get_hdr_displays` | `Vec<DisplayInfo>` | Enumerate HDR monitors via QueryDisplayConfig + luminance (EDID→DXGI planned) |
| `set_brightness` | `()` | Set for 1 display (adapter LUID + target ID + min/max nits) |
| `set_brightness_all` | `Vec<Result>` | Broadcast to all displays using luminance range (EDID or DXGI) |
| `update_displays_and_tooltip` | `()` | Cache displays + update tray tooltip/menu |
| `get_cached_displays` | `Vec<DisplayInfo>` | Sync access from tray menu context |
| `update_tray_tooltip_only` | `()` | Fast path for hotkey handlers (no menu rebuild) |
| `get_tray_rect` | `Option<Rect>` | Tray icon bounding rect for window positioning |
| `set_startup_info_mode` | `()` | Sync startup overlay state to Rust (prevents blur-to-hide) |
| `quit` | `()` | Exit process immediately via `app.exit(0)` (bypasses close-to-hide) |

**Note**: Autostart enable/disable/isEnabled handled entirely in JS via `@tauri-apps/plugin-autostart`. Rust only initializes the plugin.

## WINDOW EVENT HANDLING (lib.rs setup)

| Event | Handler | Notes |
|-------|---------|-------|
| `Focused(false)` | `on_window_event` closure | Blur-to-hide — checks `startup_info_active` before hiding |

## ANTI-PATTERNS

- **No `anyhow`/`thiserror`** — plain `Result<T, String>` everywhere
- **No `.0` on `WIN32_ERROR`** — compare directly: `result != 0`
- **No `menu.popup_menu()`** — tray menu auto-shows on right-click via pre-set
- **No `AutostartExt`** — use JS plugin API instead
- **No `app.global_shortcut()`** — use JS plugin API instead

## TRAY BEHAVIOR

- **Left-click**: Toggle window show/hide, emit `show-window` to JS for positioning
- **Right-click**: Menu already pre-set via `update_tray_menu()` — Windows auto-shows. Menu contains only device list (autostart/about/quit moved to settings overlay)
- **Menu rebuild**: On `update_displays_and_tooltip` after display load
- **Tooltip**: Updated on every brightness change (via `update_tray_tooltip_only` for hotkeys)
- **Icon**: Embedded PNG via `include_bytes!("../icons/fluent@1x.png")`

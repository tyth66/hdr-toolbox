# Rust Backend — Tauri 2 Core

**Parent:** ./AGENTS.md (root)

## Overview

Windows DisplayConfig API bindings. Low-level FFI + Tauri command layer. No external runtime deps beyond windows-rs.

## Structure

```
src-tauri/src/
├── main.rs              # Binary entry (calls lib::run())
├── lib.rs               # Tauri builder, command registration, AppState
├── display.rs           # DisplayConfig GET/SET, HDR brightness (272 lines)
└── tray.rs              # System tray icon + menu (217 lines)
                                                # (hotkey.rs: planned but never created)
```

## Module Hierarchy

```
main.rs → lib.rs (pub fn run())
     ├─→ display (pub mod display)
     │    └─ get_hdr_displays, set_brightness, set_brightness_all (Tauri commands)
     └─→ tray (pub mod tray)
          └─ setup_tray, update_tray_menu, handle_tray_click (pub)
```

## Key Data Structures

| Symbol | File | Notes |
|--------|------|-------|
| `DisplayInfo` | display.rs:22 | Serde-serializable HDR display |
| `AppState` | lib.rs:12 | `Mutex<Vec<DisplayInfo>>` shared state |
| `HDR_INFO_DISABLED` | display.rs:18 | `Lazy<AtomicBool>` kill switch |
| `DISPLAYCONFIG_SET_SDR_WHITE_LEVEL` | display.rs:75 | Custom `#[repr(C)]` 3-field struct |

## FFI Pattern (display.rs)

```rust
// Unsafe call pattern:
DisplayConfigGetDeviceInfo(header as *mut _ as *mut DISPLAYCONFIG_DEVICE_INFO_HEADER)
// Correct: as *mut _ cast, NOT direct cast
```

**Critical**: SET requires 3-field struct with `finalValue = 1`. GET uses 2-field struct.

## Anti-Patterns

- **No `anyhow`/`thiserror`** — `Result<T, String>` everywhere
- **No `.0` on WIN32_ERROR** — compare directly: `result != 0`
- **No `menu.popup_menu()`** — menu auto-shows on right-click

## Commands Exposed to JS

| Command | Returns | Notes |
|---------|---------|-------|
| `get_hdr_displays` | `Vec<DisplayInfo>` | Enumerate HDR monitors |
| `set_brightness` | `()` | Set for 1 display |
| `set_brightness_all` | `()` | Broadcast to all |

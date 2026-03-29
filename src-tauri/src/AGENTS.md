# Rust Backend - Tauri 2 Core

**Parent:** ./AGENTS.md
**Generated:** 2026-03-29 (refreshed after refactor)

## OVERVIEW

Windows DisplayConfig backend for HDR SDR brightness control. The display subsystem is now split into model, FFI, service, and command layers.

## STRUCTURE

```text
src-tauri/src/
|- main.rs                    # Binary entry
|- lib.rs                     # Tauri builder, plugins, AppState
|- tray.rs                    # Tray icon/menu/event handling
'- display/
   |- mod.rs                  # Module exports
   |- model.rs                # DisplayInfo + luminance constants
   |- ffi.rs                  # Raw DisplayConfig / MCCS calls
   |- service.rs              # HDR enumeration + brightness logic
   '- commands.rs             # Tauri command wrappers
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Shared display model | `display/model.rs` | `DisplayInfo`, luminance constants |
| Raw GET/SET SDR white level | `display/ffi.rs` | Undocumented SET struct lives here |
| HDR display discovery | `display/service.rs` | QueryDisplayConfig + fallback logic |
| Tauri command boundary | `display/commands.rs` | Stable JS-facing commands |
| Tray behavior | `tray.rs` | Left/right click and menu events |
| App state / blur-to-hide | `lib.rs` | `AppState`, `on_window_event` |

## MODULE RULES

- `ffi.rs` should contain unsafe Windows interaction, not app policy
- `service.rs` should own fallback, enumeration, kill switch, and conversions
- `commands.rs` should stay thin and forward-only
- `lib.rs` should not absorb display business logic again

## COMMAND SURFACE

- `get_hdr_displays`
- `set_brightness`
- `set_brightness_all`
- `update_displays_and_tooltip`
- `get_cached_displays`
- `update_tray_tooltip_only`
- `get_tray_rect`
- `set_startup_info_mode`
- `set_dragging_mode`
- `quit`

## CRITICAL NOTES

- SDR white level control still uses undocumented type `0xFFFFFFEE`
- The custom SET struct must include `final_value = 1`
- MCCS values are informational only
- Physical monitor handles are explicitly released after MCCS queries
- Failure kill switch still disables HDR enumeration after repeated failures

# Rust Backend - Tauri 2 Core

**Parent:** ./AGENTS.md
**Generated:** 2026-04-01

## OVERVIEW

Windows DisplayConfig backend for HDR SDR brightness control. Display subsystem splits into model, FFI, service, session, and command layers with unit tests for pure service/session helpers.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Display model | `display/model.rs` | `DisplayInfo`, luminance constants |
| FFI boundary | `display/ffi.rs` | Raw DisplayConfig calls |
| HDR discovery | `display/service.rs` | QueryDisplayConfig + failure tracking |
| Display session | `display/session.rs` | AppState cache updates + TrayState synchronization |
| Commands | `display/commands.rs` | Stable, thin JS-facing commands |
| App state | `app/state.rs` | `AppState`, `TrayState`, `TrayDisplaySummary` |
| Window | `app/window.rs` | Mica + blur-to-hide |
| Tray | `tray.rs` | Left/right click from summary state |

## MODULE RULES

- `ffi.rs`: unsafe Windows interaction only, no app policy
- `ffi.rs` and `service.rs`: return structured `DisplayError`, not stringly typed errors
- `service.rs`: enumeration, brightness, per-display failure tracking
- `session.rs`: display cache writes, tray summary writes, tray refresh calls
- `commands.rs`: command boundary only; no direct cache/tray synchronization and no string error classification
- `tray.rs`: depends on tray summary state, not full `DisplayInfo`

## FAILURE TRACKING

`PerDisplayFailureTracker` with `HashMap<DisplayKey, usize>`:
- Display skipped after 3 consecutive failures (that display only)
- Other displays unaffected
- Key: `(adapter_id_low, adapter_id_high, target_id)`

## COMMAND SURFACE

`get_hdr_displays` | `set_brightness` | `set_brightness_all` | `set_hdr_enabled` | `get_tray_rect` | `set_startup_info_mode` | `set_dragging_mode` | `quit`

## CRITICAL NOTES

- SDR white level: undocumented type `0xFFFFFFEE` with `final_value = 1`
- SDR White Level is the brightness control path; MCCS brightness range is not used for enumeration
- Bit 0 (`0x1`): HDR-capable; Bit 1 (`0x2`): HDR enabled
- Enumeration returns HDR-capable displays even when HDR is off

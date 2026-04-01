# Rust Backend - Tauri 2 Core

**Parent:** ./AGENTS.md
**Generated:** 2026-03-31 (refreshed)

## OVERVIEW

Windows DisplayConfig backend for HDR SDR brightness control. The display subsystem is split into model, FFI, service, and command layers, with unit tests covering pure service helpers.

## STRUCTURE

```text
src-tauri/src/
|- main.rs                    # Binary entry
|- lib.rs                     # Tauri builder and module wiring
|- app/
|  |- mod.rs
|  |- state.rs                # AppState + TrayState
|  |- commands.rs             # Non-display Tauri commands
|  '- window.rs               # Backdrop + blur-to-hide behavior
|- tray.rs                    # Tray icon/menu/event handling
'- display/
   |- mod.rs                  # Module exports
   |- model.rs                # DisplayInfo + luminance constants
   |- ffi.rs                  # Raw DisplayConfig / MCCS calls
   |- service.rs              # HDR enumeration + brightness logic + tests
   '- commands.rs             # Tauri command wrappers
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Shared display model | `display/model.rs` | `DisplayInfo`, luminance constants, `hdr_supported` / `hdr_enabled` |
| Raw GET/SET SDR white level + HDR state | `display/ffi.rs` | SDR white level and advanced color state writes live here |
| HDR-capable display discovery | `display/service.rs` | QueryDisplayConfig + supported/enabled parsing + fallback logic |
| Failure-state helpers | `display/service.rs` | Kill switch and reset helper functions |
| Tauri command boundary | `display/commands.rs` | Stable JS-facing commands plus authoritative state updates |
| App state | `app/state.rs` | `AppState`, `TrayState`, `TrayDisplaySummary` |
| Window behavior | `app/window.rs` | `on_window_event`, Mica, blur-to-hide |
| Tray behavior | `tray.rs` | Left/right click and menu events from summary state |

## MODULE RULES

- `ffi.rs` should contain unsafe Windows interaction, not app policy
- `service.rs` should own enumeration, brightness logic, and per-display failure tracking
- `commands.rs` should stay at the command boundary and own state synchronization, not low-level Windows details
- `lib.rs` should not absorb display business logic again
- `tray.rs` should depend on tray summary state, not full `DisplayInfo`
- Add tests in `service.rs` when logic can be validated without Windows handles

## FAILURE TRACKING

Per-display failure tracking replaces the previous global kill switch:

- `PerDisplayFailureTracker` uses `HashMap<DisplayKey, usize>` to track failures per display
- A display is skipped after 3 consecutive failures for THAT display only
- Other displays remain unaffected
- Successful queries reset the failure count for that display
- Key: `(adapter_id_low, adapter_id_high, target_id)` uniquely identifies a display

## COMMAND SURFACE

- `get_hdr_displays`
- `set_brightness`
- `set_brightness_all`
- `set_hdr_enabled`
- `get_tray_rect`
- `set_startup_info_mode`
- `set_dragging_mode`
- `quit`

## CURRENT TEST COVERAGE

- `percentage_to_nits` bounds, midpoint, clamping, inverted range
- advanced color supported/enabled bit parsing
- `PerDisplayFailureTracker` disable threshold
- `PerDisplayFailureTracker` reset on success
- `PerDisplayFailureTracker` tracks displays independently
- `TrayState` keeps only tray-relevant display fields

## CRITICAL NOTES

- SDR white level control uses undocumented type `0xFFFFFFEE` (defined as `DISPLAYCONFIG_DEVICE_INFO_SET_SDR_WHITE_LEVEL` in `ffi.rs`)
- The custom SET struct must include `final_value = 1`
- MCCS values are informational only
- `DISPLAYCONFIG_GET_ADVANCED_COLOR_INFO` bit 0 (`0x1`) is treated as HDR-capable, bit 1 (`0x2`) as currently enabled
- `DISPLAYCONFIG_SET_ADVANCED_COLOR_STATE` is used to toggle HDR
- Enumeration keeps HDR-capable displays even when HDR is off
- Rust commands update authoritative display state and tray summary state directly
- Tray rendering is based on `TrayState` summaries rather than the full display model
- Physical monitor handles are explicitly released after MCCS queries
- **Per-display failure tracking**: each display tracks its own failure count; other displays unaffected by one display's failures

# Rust Backend - Tauri 2 Core

**Parent:** ./AGENTS.md
**Generated:** 2026-06-29

## OVERVIEW

Windows DisplayConfig backend for HDR SDR brightness control. The display contract has started the Universal Brightness Control migration with `BrightnessSource`, generic brightness metadata, pure brightness conversion/routing helpers, DDC/CI provider code, native COM/WMI internal-panel provider code, and service-level provider result merging. Display subsystem splits into model, brightness helpers, providers, FFI, service, session, and command layers with unit tests for pure service/session helpers.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Display model | `display/model.rs` | `DisplayInfo`, `BrightnessSource`, generic brightness fields, luminance constants |
| Brightness helpers | `display/brightness.rs` | Pure percent/nits conversion, DDC raw scaling, source-to-hardware value selection |
| DDC/CI provider | `display/ddcci.rs` | Physical monitor enumeration, high-level brightness, VCP brightness, and raw scaling |
| WMI provider | `display/wmi.rs` | Native COM/WMI internal-panel enumeration and brightness writes |
| FFI boundary | `display/ffi.rs` | Raw DisplayConfig calls |
| Display discovery | `display/service.rs` | HDR SDR enumeration, provider merge, QueryDisplayConfig failure tracking |
| Display errors | `display/error.rs` | Structured DisplayConfig, DDC, and WMI error codes |
| Display session | `display/session.rs` | AppState cache updates + TrayState synchronization |
| Commands | `display/commands.rs` | Stable, thin JS-facing commands |
| App state | `app/state.rs` | `AppState`, `TrayState`, `TrayDisplaySummary` |
| Window | `app/window.rs` | Acrylic + blur-to-hide |
| Tray | `tray.rs` | Left/right click from summary state |

## MODULE RULES

- `ffi.rs`: unsafe Windows interaction only, no app policy
- `ffi.rs` and `service.rs`: return structured `DisplayError`, not stringly typed errors
- `error.rs`: keep provider failures as explicit `DisplayErrorCode` variants, not message parsing
- `service.rs`: HDR SDR enumeration, provider result merge, brightness, per-display failure tracking
- `session.rs`: display cache writes, tray summary writes, tray refresh calls
- `commands.rs`: command boundary only; no direct cache/tray synchronization and no string error classification
- `brightness.rs`: pure conversion/routing only; no Windows API calls and no app state
- `ddcci.rs`: physical monitor, VCP, and high-level monitor brightness APIs only; owns physical monitor handle enumeration, high-level reads/writes, VCP reads/writes, and cleanup
- `wmi.rs`: internal-panel WMI brightness APIs only; owns `ROOT\WMI` queries and `WmiSetBrightness` calls
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
- Current production enumeration merges HDR SDR, DDC/CI, and WMI providers; backend brightness writes route by `BrightnessSource`
- `BrightnessSource` variants are `HdrSdr`, `DdcHighLevel`, `DdcVcp`, and `Wmi`; enumeration assigns source-specific values. HDR-capable displays with DDC support carry `ddc_source` metadata for automatic source switching on HDR toggle.
- `DisplayInfo.brightness` is normalized 0-100; `DisplayInfo.nits` remains the HDR SDR white-level value
- `brightness_raw`, `brightness_raw_max`, `brightness_device_id`, and `brightness_vcp_code` carry provider raw scales and stable write-routing metadata
- `display/brightness.rs` provides HDR SDR percent/nits conversion plus source-to-hardware value selection
- `DisplayInfo.ddc_source` stores fallback DDC brightness source; `flip_hdr_source_in_cache` in `session.rs` swaps `brightness_source` on HDR toggle without re-enumeration
- DDC/WMI provider errors have dedicated codes and constructors for enumeration and brightness failures
- `display/ddcci.rs` now implements DDC/CI Windows enumeration and writes; `display/wmi.rs` now implements native COM/WMI enumeration and writes; service-level merge and generic brightness write routing are implemented
- WMI COM initialization accepts `RPC_E_CHANGED_MODE` as a borrowed host apartment; only successful `CoInitializeEx` calls owned by this module should be paired with `CoUninitialize`
- DDC VCP priority is `0x10`, `0x13`, `0x6B`, then `0x12`; raw scaling uses the monitor-reported max value
- Bit 0 (`0x1`): HDR-capable; Bit 1 (`0x2`): HDR enabled
- Enumeration returns HDR-capable displays even when HDR is off

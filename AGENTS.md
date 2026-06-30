# HDR Toolbox - Knowledge Base

**Generated:** 2026-06-29
**Type:** Rust + Tauri 2 (Windows desktop app)

## OVERVIEW

Windows system tray app for universal brightness control across HDR SDR white level, DDC/CI external-monitor brightness, and WMI internal-panel brightness. Rust FFI/provider backend + React/TypeScript frontend bundled by Tauri 2.

## STRUCTURE

```text
./
|- src/                        # React/TypeScript frontend
|  |- App.tsx                  # Composition layer
|  |- main.tsx                 # React mount + close-to-hide
|  |- app/                     # App-level controllers
|  |- brightness/              # Slider interaction
|  |- components/             # Presentational UI
|  |- hooks/                   # Stateful logic (display state/commands/feedback, hotkeys, window)
|  |- services/tauriApi.ts     # Typed Tauri invoke wrappers
|  |- theme.ts                 # Fluent theme generation from fixed Codex accent
|  |- visualQa.tsx             # Static browser visual QA harness
|  '- types.ts                 # Shared constants + DisplayInfo/BrightnessSource contract
|- src-tauri/src/
|  |- lib.rs                   # Tauri builder + module wiring
|  |- app/                     # State, commands, logging, window
|  |- display/                 # FFI, model, brightness helpers, provider stubs, service, session, commands, error
|  '- tray.rs                  # System tray
|- DESIGN.md                   # Current UI/design source of truth
|- visual-qa.html              # Browser QA entrypoint
|- package.json
|- vite.config.ts
'- tsconfig.json
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Frontend composition | `src/App.tsx` | Wires controllers, hooks, and components |
| App render exports | `src/components/AppSurfaces.tsx` | Barrel export for state and main surfaces |
| App state surfaces | `src/components/AppStateSurfaces.tsx` | Loading, error, and empty shell JSX |
| Main app surface | `src/components/MainSurface.tsx` | Main display/settings/about/startup shell with grouped props |
| Tauri API boundary | `src/services/tauriApi.ts` | Only place that calls `invoke()` |
| App-level control | `src/app/useAppController.ts` | Composition over focused app controllers |
| Dialog control | `src/app/useDialogController.ts` | Settings/about dialog state |
| Settings control | `src/app/useSettingsController.ts` | Autostart, sync brightness, theme preference |
| Hotkey control | `src/app/useHotkeyController.ts` | Hotkey recording, validation, persistence, registration |
| Tray events | `src/app/useTrayDisplayEvents.ts` | Initial load and Tauri tray events |
| Brightness control | `src/brightness/useBrightnessController.ts` | Slider drag, commit, wheel |
| Brightness interaction | `src/brightness/brightnessInteraction.ts` | Pure wheel-step brightness math |
| Display facade | `src/hooks/useDisplays.ts` | Public display-state hook |
| Display state store | `src/hooks/useDisplayStateStore.ts` | Selected display, refs, percentage, HDR-active derivation |
| Display command client | `src/hooks/useDisplayCommandClient.ts` | Frontend display-command adapter over typed Tauri wrappers |
| Display feedback state | `src/hooks/useDisplayFeedbackState.ts` | Loading, refreshing, HDR pending, blocking errors, notices |
| Display actions | `src/hooks/useDisplayDeviceActions.ts` | Refresh, brightness, HDR toggle orchestration over command/feedback boundaries |
| Display state helpers | `src/hooks/displayState.ts` | Pure selection/update helpers |
| Hotkeys | `src/hooks/useHotkeys.ts` + `src/hotkeys.ts` | User-configurable accelerators |
| Theme preference | `src/themePreference.ts` + `src/hooks/useSystemColorScheme.ts` | System/Light/Dark persisted preference |
| Fixed accent | `src/hooks/useAccentColor.ts` + `src/theme.ts` | Applies fixed Codex accent to CSS/Fluent tokens |
| Visual QA | `visual-qa.html` + `src/visualQa.tsx` | Static WebView-state harness for browser QA |
| Window position | `src/hooks/useWindowPosition.ts` | Saved position + tray placement |
| Startup overlay | `src/hooks/useStartupOverlay.ts` | 4s info + Rust sync |
| Error mapping | `src/errors.ts` | User-facing error messages + provider error-code contract |
| Contract checks | `src/displayContract.test.ts` | TS/Rust DisplayInfo and BrightnessSource drift detection |
| Architecture checks | `src/architectureContract.test.ts` | Tauri boundary, DisplayConfig, DDC/CI, and WMI module boundary checks |
| Brightness source helpers | `src-tauri/src/display/brightness.rs` | Pure percent/nits conversion, DDC raw scaling, source-to-hardware value selection |
| Brightness reader | `src-tauri/src/display/reader.rs` | Source-routed known-device brightness/HDR state reads |
| DDC/CI provider | `src-tauri/src/display/ddcci.rs` | Physical monitor enumeration, high-level brightness, VCP brightness, and raw scaling |
| WMI provider | `src-tauri/src/display/wmi.rs` | Native COM/WMI internal-panel enumeration and brightness writes |
| DisplayConfig FFI | `src-tauri/src/display/ffi.rs` | DisplayConfig enumeration, HDR state, and SDR white level |
| Display service | `src-tauri/src/display/service.rs` | HDR/Provider enumeration merge, toggle polling, brightness logic, structured errors |
| Display session | `src-tauri/src/display/session.rs` | Display cache updates + tray state synchronization |
| Display commands | `src-tauri/src/display/commands.rs` | Thin Tauri command boundary |
| App state | `src-tauri/src/app/state.rs` | AppState + TrayState |
| File logging | `src-tauri/src/app/logging.rs` | Timestamped log files, 10MB rotation, max 3 files |
| Tray management | `src-tauri/src/tray.rs` | Dynamic menu, tooltip, click handlers |
| Blur-to-hide | `src-tauri/src/app/window.rs` | Acrylic + `on_window_event(Focused(false))` |

## FRONTEND ARCHITECTURE

- `components/`: presentational UI only
- `components/AppSurfaces.tsx`: barrel export; `AppStateSurfaces.tsx` owns loading/error/empty shells and `MainSurface.tsx` owns the main app shell with grouped props
- `app/useAppController.ts`: composition over focused app controllers for dialogs, settings, hotkeys, and tray events
- `hooks/`: stateful logic and side effects; display flow is split into state store, command client, feedback state, and device action orchestration
- `services/`: typed Tauri bridge
- `theme.ts`: Fluent UI v9 brand ramp and effective theme helpers
- `visualQa.tsx`: static QA-only rendering of production components
- `types.ts`: shared constants, conversion helpers, and `BrightnessSource`/`DisplayInfo` contract
- `*.test.ts`: Node test runner coverage for pure frontend logic

**Key rules:** No raw `invoke()` outside `services/tauriApi.ts`; display actions use `useDisplayCommandClient()` rather than Tauri services directly; keep `App.tsx` as composition; keep `components/AppSurfaces.tsx` as a re-export barrel with state shells in `AppStateSurfaces.tsx` and main shell JSX in `MainSurface.tsx`; error copy in `errors.ts`; keep visual QA using a non-blue test accent so accent regressions are visible.

## RUST ARCHITECTURE

- `display/model.rs`: DisplayInfo, BrightnessSource, generic brightness metadata, and luminance constants (80-480 nits)
- `display/brightness.rs`: pure brightness conversion/routing helpers; no Windows API calls
- `display/ddcci.rs`: DDC/CI provider module for physical monitor enumeration, VCP reads/writes, and high-level brightness reads/writes
- `display/wmi.rs`: internal-panel WMI brightness provider through native COM/WMI
- `display/ffi.rs`: raw Windows DisplayConfig FFI
- `display/error.rs`: structured error types (DisplayErrorCode, DisplayError), including DDC/WMI provider failure codes
- `display/service.rs`: HDR discovery, provider result merge, toggle, brightness logic, tests; HDR entries store the DisplayConfig monitor device path when available so DDC/CI can merge by provider identity before display-name fallback
- `display/session.rs`: AppState display cache + TrayState synchronization
- `display/commands.rs`: thin Tauri command surface
- `app/state.rs`: AppState + TrayState + TrayDisplaySummary
- `app/logging.rs`: tracing subscriber setup, stderr tee, timestamped file logs, and size-based rotation
- `app/window.rs`: blur-to-hide + Acrylic backdrop
- `tray.rs`: tray icon, menu, events from summary state
- `lib.rs`: Tauri builder and module wiring

**Key rules:** Commands return `DisplayError` with structured error codes; service/FFI return structured `DisplayError` rather than string errors; `display/session.rs` owns display-cache/tray synchronization; no `anyhow`/`thiserror`; FFI details stay in `display/ffi.rs`

## CONVENTIONS

### Rust
- Commands return `DisplayError` with structured error codes; no `anyhow`/`thiserror`
- Do not classify display failures by matching strings in command handlers
- Keep display cache and tray synchronization in `display/session.rs`, not `display/commands.rs`
- Use `display::model::luminance::*` instead of hardcoded luminance values
- Keep undocumented DisplayConfig details inside `display/ffi.rs`
- Keep pure service logic testable without touching Windows APIs

### Frontend
- React hooks only; no router
- Keep `App.tsx` as composition, not business logic dumping ground
- Keep `components/AppSurfaces.tsx` as a re-export barrel; loading/error/empty shells belong in `components/AppStateSurfaces.tsx`, and main shell JSX belongs in `components/MainSurface.tsx`
- No raw `invoke()` outside `services/tauriApi.ts`
- `useDisplayDeviceActions.ts` must depend on `useDisplayCommandClient.ts`, not `services/tauriApi.ts`
- Keep display selection/refs in `useDisplayStateStore.ts` and display loading/error/notice state in `useDisplayFeedbackState.ts`
- Use Fluent UI v9 for Slider, Switch, Button, and Provider
- Fixed Codex accent must flow through `useAccentColor()` -> CSS vars + Fluent theme
- Window display must refresh accent before showing the window, not after showing it
- Exclude `*.test.ts` from production TypeScript build

### Tauri 2
- `tray-icon` + `image-png` features
- JS-side global shortcut registration and autostart
- Rust-side blur-to-hide for frameless window reliability
- Transparent WebView with Windows Acrylic backdrop via `window-vibrancy`
- `tauri-plugin-single-instance` for single-instance enforcement

## ANTI-PATTERNS (THIS PROJECT)

- `DO NOT REMOVE!!` comment in `src-tauri/src/main.rs` — process constraints belong in issue tracker, not code
- No ESLint/Prettier — minimal JS tooling

## SUBMODULES

- `src/AGENTS.md` — Frontend architecture, hooks, component rules
- `src-tauri/src/AGENTS.md` — Rust backend, display subsystem, FFI details

## TOOLING

- `rustfmt.toml` — Rust formatting (src-tauri/)
- `clippy.toml` — Clippy lint configuration (src-tauri/)
- CI runs on every branch push and pull request
- CI should run `cargo fmt --check`, `cargo clippy`, frontend checks, and Rust tests
- Release builds run automatically after successful `main` push CI, upload Windows Tauri artifacts, and publish the formal `HDR Toolbox` GitHub Release
- Formal release publishing uses the fixed `release` tag and stable asset filenames without version suffixes. The workflow deletes and recreates the rolling GitHub Release after a successful build so the release page timestamp reflects the latest publish while download URLs remain stable.

## CRITICAL NOTES

- SDR white level range: **80-480 nits** (fixed)
- Current display enumeration merges HDR SDR, DDC/CI, and WMI provider results behind the existing `get_hdr_displays` command name. DDC/CI merge matches monitor device identity before falling back to display-name equality, so one HDR+DDC physical monitor remains one app entry. If that entry is enumerated while HDR is off, merge activates the DDC/WMI fallback source immediately and uses the provider brightness percentage.
- Refresh paths are intentionally split: initial load and manual title-bar refresh call `get_hdr_displays` for full provider discovery; tray wake and window focus call `refresh_known_display_state` for cached-display hardware reads only.
- `refresh_known_display_state` reads the cached display HDR state and current active brightness source. If HDR is still off and the active source is already DDC/WMI, `source_state.rs` must keep that provider source active.
- Service fallback from known-state refresh to `get_hdr_displays` is for known-device read failures only; do not add source-state validation that forces discovery before attempting the known read.
- Brightness writes are source-routed in Rust: HDR SDR uses DisplayConfig, DDC high-level/VCP uses `display/ddcci.rs`, and WMI uses `display/wmi.rs`
- `BrightnessSource` currently includes `HdrSdr`, `DdcHighLevel`, `DdcVcp`, and `Wmi`
- `DisplayInfo.brightness` is the normalized 0-100 slider value; `DisplayInfo.nits` remains the HDR SDR white-level value for `HdrSdr`
- `brightness_raw`, `brightness_raw_max`, `brightness_device_id`, and `brightness_vcp_code` are part of the shared contract for provider-specific raw scales and write routing. For initial HDR SDR entries, `brightness_device_id` stores the DisplayConfig monitor device path when available for DDC/CI identity matching; after fallback injection it stores the DDC/WMI write key.
- `display/brightness.rs` maps HDR SDR percent to 80-480 nits, maps SDR nits back to percent, scales DDC VCP percent to raw max, and keeps WMI/high-level DDC as percent values
- DDC/WMI provider error codes are part of the shared contract: `ddc_enumeration_failed`, `ddc_brightness_failed`, `wmi_enumeration_failed`, and `wmi_brightness_failed`
- Provider module boundaries are pinned by `src/architectureContract.test.ts`: physical monitor APIs belong in `display/ddcci.rs`; WMI brightness APIs belong in `display/wmi.rs`
- `display/ddcci.rs` VCP priority is luminance `0x10`, brightness `0x13`, backlight `0x6B`, then contrast `0x12`; raw scaling uses reported max values
- DDC/CI provider implementation exists in `display/ddcci.rs`; service-level provider merge and source-routed app writes are implemented
- WMI provider implementation exists in `display/wmi.rs`; service-level provider merge and source-routed app writes are implemented
- WMI COM initialization treats `RPC_E_CHANGED_MODE` as a reusable host COM apartment and must not call `CoUninitialize` for that borrowed apartment
- Frontend source-aware slider gating and non-HDR labels are implemented
- `DisplayInfo` distinguishes `hdr_supported` from `hdr_enabled`
- Display enumeration returns HDR-capable displays even when HDR is off
- Rust owns authoritative display state; frontend consumes command results
- Tray rendering uses `TrayState`/`TrayDisplaySummary` not full `DisplayInfo`
- Display cache updates and tray refresh coordination are centralized in `display/session.rs`
- SET SDR white level uses undocumented device info type `0xFFFFFFEE`
- HDR toggle uses `DISPLAYCONFIG_SET_ADVANCED_COLOR_STATE` + brief polling
- **Per-display failure tracking**: failures are tracked per-display (via `DisplayKey`), not globally. A display is skipped after 3 consecutive failures, but recovers on next successful query.
- Tray menu must be set before right-click; do not use `popup_menu()`
- Each tray-show and window focus triggers silent known-device state refresh; it must keep an already-active DDC/WMI source when HDR remains off, and must not re-run full HDR/DDC/WMI provider discovery or replay the startup overlay unless the cached entry is unrecoverable
- Manual refresh remains the full HDR/DDC/WMI provider enumeration path
- Only manual refresh should drive the visible title-bar refresh indicator; tray-show and window-focus known-device refreshes must pass `silent: true` and not set the shared refresh spinner state
- Hotkeys: 4% step; mouse wheel on slider: 2% step
- Frontend display-state hooks use `DisplayInfo.brightness` as the slider value and update `nits` only for `brightness_source === "hdr_sdr"`
- Component-level brightness UI is source-aware: HDR SDR depends on HDR enabled; DDC/WMI brightness controls do not
- Tray summaries use generic brightness percentages plus `BrightnessSource`, not HDR-only nits
- Non-blocking failures: auto-dismissing notice banner; init failures: blocking
- **Single instance**: `tauri-plugin-single-instance` prevents multiple app instances; second instance focuses existing window
- **Structured errors**: FFI/service/commands use `DisplayError`; commands return `{ code: DisplayErrorCode, message: string }` for precise frontend error handling
- **File logs**: Rust tracing writes timestamped `.log` files under `log/`; debug builds use the repository `log/`, release builds use the executable directory `log/`. Each file is capped at 10MB and at most 3 log files are kept by deleting the oldest before creating a new one.
- **Fixed accent**: `useAccentColor()` applies Codex accent `#339CFF`; the window refreshes accent variables before every show.
- **UI baseline**: Acrylic transparent shell + Fluent UI v9 controls + fixed-accent hover/active/focus states + 4-8px control radius.
- **Visual QA**: use `agent-browser` against `visual-qa.html`; the harness intentionally uses a non-blue accent (`#c38aa0`) to expose default-blue regressions.

## COMMANDS

```bash
npm run tauri dev   # Development
npm run tauri build # Production build
npm test            # Frontend + Rust tests
```

## BUILD STATUS

- Frontend build: ✓
- Rust `cargo check`: ✓
- Node tests: ✓
- Rust unit tests: ✓

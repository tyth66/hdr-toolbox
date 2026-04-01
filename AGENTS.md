# HDR Toolbox - Knowledge Base

**Generated:** 2026-04-01 (refreshed)
**Type:** Rust + Tauri 2 (Windows desktop app)

## OVERVIEW

Windows system tray app for HDR monitor SDR brightness control via Windows DisplayConfig API. Rust FFI backend + React/TypeScript frontend bundled by Tauri 2.

## STRUCTURE

```text
./
|- src/                        # React/TypeScript frontend
|  |- App.tsx                  # Composition layer
|  |- main.tsx                 # React mount + close-to-hide
|  |- app/                     # App-level controllers
|  |- brightness/              # Slider interaction
|  |- components/             # Presentational UI
|  |- hooks/                   # Stateful logic (display, hotkeys, window)
|  |- services/tauriApi.ts     # Typed Tauri invoke wrappers
|  '- types.ts                 # Shared constants
 |- src-tauri/src/
|  |- lib.rs                   # Tauri builder + module wiring
|  |- app/                     # State, commands, window
|  |- display/                 # FFI, model, service, commands, error
|  '- tray.rs                  # System tray
|- package.json
|- vite.config.ts
'- tsconfig.json
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Frontend composition | `src/App.tsx` | Wires controllers, hooks, and components |
| Tauri API boundary | `src/services/tauriApi.ts` | Only place that calls `invoke()` |
| App-level control | `src/app/useAppController.ts` | Init, tray events, autostart, dialogs, quit |
| Brightness control | `src/brightness/useBrightnessController.ts` | Slider drag, commit, wheel |
| Display facade | `src/hooks/useDisplays.ts` | Public display-state hook |
| Display selection | `src/hooks/useDisplaySelection.ts` | Selected display, HDR-active derivation |
| Display actions | `src/hooks/useDisplayDeviceActions.ts` | Refresh, brightness, HDR toggle |
| Display state helpers | `src/hooks/displayState.ts` | Pure selection/update helpers |
| Hotkeys | `src/hooks/useHotkeys.ts` + `src/hotkeys.ts` | User-configurable accelerators |
| Window position | `src/hooks/useWindowPosition.ts` | Saved position + tray placement |
| Startup overlay | `src/hooks/useStartupOverlay.ts` | 4s info + Rust sync |
| Error mapping | `src/errors.ts` | User-facing error messages |
| Contract checks | `src/displayContract.test.ts` | TS/Rust DisplayInfo drift detection |
| DisplayConfig FFI | `src-tauri/src/display/ffi.rs` | GET/SET SDR white level + MCCS |
| Display service | `src-tauri/src/display/service.rs` | HDR enumeration, toggle polling, fallback |
| Display commands | `src-tauri/src/display/commands.rs` | Tauri command boundary + state updates |
| App state | `src-tauri/src/app/state.rs` | AppState + TrayState |
| Tray management | `src-tauri/src/tray.rs` | Dynamic menu, tooltip, click handlers |
| Blur-to-hide | `src-tauri/src/app/window.rs` | Mica + `on_window_event(Focused(false))` |

## FRONTEND ARCHITECTURE

- `components/`: presentational UI only
- `hooks/`: stateful logic and side effects
- `services/`: typed Tauri bridge
- `types.ts`: shared constants and conversion helpers
- `*.test.ts`: Node test runner coverage for pure frontend logic

**Key rules:** No raw `invoke()` outside `services/tauriApi.ts`; keep `App.tsx` as composition; error copy in `errors.ts`.

## RUST ARCHITECTURE

- `display/model.rs`: DisplayInfo + luminance constants (80-480 nits)
- `display/ffi.rs`: raw Windows DisplayConfig / MCCS FFI
- `display/error.rs`: structured error types (DisplayErrorCode, DisplayError)
- `display/service.rs`: HDR discovery, toggle, brightness logic, tests
- `display/commands.rs`: Tauri command surface + state updates
- `app/state.rs`: AppState + TrayState + TrayDisplaySummary
- `app/window.rs`: blur-to-hide + Mica backdrop
- `tray.rs`: tray icon, menu, events from summary state
- `lib.rs`: Tauri builder and module wiring

**Key rules:** Commands return `DisplayError` with structured error codes; no `anyhow`/`thiserror`; FFI details stay in `display/ffi.rs`

## CONVENTIONS

### Rust
- Commands return `DisplayError` with structured error codes; no `anyhow`/`thiserror`
- Use `display::model::luminance::*` instead of hardcoded luminance values
- Keep undocumented DisplayConfig details inside `display/ffi.rs`
- Keep pure service logic testable without touching Windows APIs

### Frontend
- React hooks only; no router
- Keep `App.tsx` as composition, not business logic dumping ground
- No raw `invoke()` outside `services/tauriApi.ts`
- Exclude `*.test.ts` from production TypeScript build

### Tauri 2
- `tray-icon` + `image-png` features
- JS-side global shortcut registration and autostart
- Rust-side blur-to-hide for frameless window reliability
- `tauri-plugin-single-instance` for single-instance enforcement

## ANTI-PATTERNS (THIS PROJECT)

- `DO NOT REMOVE!!` comment in `src-tauri/src/main.rs` — process constraints belong in issue tracker, not code
- Multiple `AGENTS.md` in subdirs — avoid future proliferation; update existing instead
- No ESLint/Prettier — minimal JS tooling

## TOOLING

- `rustfmt.toml` — Rust formatting (src-tauri/)
- `clippy.toml` — Clippy lint configuration (src-tauri/)
- CI should run `cargo clippy` and `cargo test`

## CRITICAL NOTES

- SDR white level range: **80-480 nits** (fixed)
- MCCS brightness is informational only; SDR White Level is the actual control path
- `DisplayInfo` distinguishes `hdr_supported` from `hdr_enabled`
- Display enumeration returns HDR-capable displays even when HDR is off
- Rust owns authoritative display state; frontend consumes command results
- Tray rendering uses `TrayState`/`TrayDisplaySummary` not full `DisplayInfo`
- SET SDR white level uses undocumented device info type `0xFFFFFFEE`
- HDR toggle uses `DISPLAYCONFIG_SET_ADVANCED_COLOR_STATE` + brief polling
- **Per-display failure tracking**: failures are tracked per-display (via `DisplayKey`), not globally. A display is skipped after 3 consecutive failures, but recovers on next successful query.
- Tray menu must be set before right-click; do not use `popup_menu()`
- Each tray-show triggers silent display-state refresh (no startup overlay replay)
- Hotkeys: 4% step; mouse wheel on slider: 2% step
- SDR brightness controls disabled while HDR is off
- Non-blocking failures: auto-dismissing notice banner; init failures: blocking
- **Single instance**: `tauri-plugin-single-instance` prevents multiple app instances; second instance focuses existing window
- **Structured errors**: Commands return `{ code: DisplayErrorCode, message: string }` for precise frontend error handling

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

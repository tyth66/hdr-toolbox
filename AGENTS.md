# HDR Toolbox - Knowledge Base

**Generated:** 2026-06-29
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
|  |- hooks/                   # Stateful logic (display state/commands/feedback, hotkeys, window)
|  |- services/tauriApi.ts     # Typed Tauri invoke wrappers
|  |- theme.ts                 # Fluent theme generation from system accent
|  |- visualQa.tsx             # Static browser visual QA harness
|  '- types.ts                 # Shared constants
 |- src-tauri/src/
|  |- lib.rs                   # Tauri builder + module wiring
|  |- app/                     # State, commands, window
|  |- display/                 # FFI, model, service, session, commands, error, accent
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
| App render surfaces | `src/components/AppSurfaces.tsx` | Loading, error, empty, and main shell JSX |
| Tauri API boundary | `src/services/tauriApi.ts` | Only place that calls `invoke()` |
| App-level control | `src/app/useAppController.ts` | Init, tray events, autostart, dialogs, quit |
| Brightness control | `src/brightness/useBrightnessController.ts` | Slider drag, commit, wheel |
| Display facade | `src/hooks/useDisplays.ts` | Public display-state hook |
| Display state store | `src/hooks/useDisplayStateStore.ts` | Selected display, refs, percentage, HDR-active derivation |
| Display command client | `src/hooks/useDisplayCommandClient.ts` | Frontend display-command adapter over typed Tauri wrappers |
| Display feedback state | `src/hooks/useDisplayFeedbackState.ts` | Loading, refreshing, HDR pending, blocking errors, notices |
| Display actions | `src/hooks/useDisplayDeviceActions.ts` | Refresh, brightness, HDR toggle orchestration over command/feedback boundaries |
| Display state helpers | `src/hooks/displayState.ts` | Pure selection/update helpers |
| Hotkeys | `src/hooks/useHotkeys.ts` + `src/hotkeys.ts` | User-configurable accelerators |
| Theme preference | `src/themePreference.ts` + `src/hooks/useSystemColorScheme.ts` | System/Light/Dark persisted preference |
| System accent | `src/hooks/useAccentColor.ts` + `src/theme.ts` | Reads Windows accent and applies CSS/Fluent tokens |
| Visual QA | `visual-qa.html` + `src/visualQa.tsx` | Static WebView-state harness for browser QA |
| Window position | `src/hooks/useWindowPosition.ts` | Saved position + tray placement |
| Startup overlay | `src/hooks/useStartupOverlay.ts` | 4s info + Rust sync |
| Error mapping | `src/errors.ts` | User-facing error messages |
| Contract checks | `src/displayContract.test.ts` | TS/Rust DisplayInfo drift detection |
| DisplayConfig FFI | `src-tauri/src/display/ffi.rs` | DisplayConfig enumeration, HDR state, and SDR white level |
| Display service | `src-tauri/src/display/service.rs` | HDR enumeration, toggle polling, brightness logic, structured errors |
| Display session | `src-tauri/src/display/session.rs` | Display cache updates + tray state synchronization |
| Display commands | `src-tauri/src/display/commands.rs` | Thin Tauri command boundary |
| System accent command | `src-tauri/src/display/accent.rs` | Reads Windows DWM accent color from registry |
| App state | `src-tauri/src/app/state.rs` | AppState + TrayState |
| Tray management | `src-tauri/src/tray.rs` | Dynamic menu, tooltip, click handlers |
| Blur-to-hide | `src-tauri/src/app/window.rs` | Acrylic + `on_window_event(Focused(false))` |

## FRONTEND ARCHITECTURE

- `components/`: presentational UI only
- `components/AppSurfaces.tsx`: app-level render surfaces; keeps `App.tsx` focused on composition and state branching
- `hooks/`: stateful logic and side effects; display flow is split into state store, command client, feedback state, and device action orchestration
- `services/`: typed Tauri bridge
- `theme.ts`: Fluent UI v9 brand ramp and effective theme helpers
- `visualQa.tsx`: static QA-only rendering of production components
- `types.ts`: shared constants and conversion helpers
- `*.test.ts`: Node test runner coverage for pure frontend logic

**Key rules:** No raw `invoke()` outside `services/tauriApi.ts`; display actions use `useDisplayCommandClient()` rather than Tauri services directly; keep `App.tsx` as composition and keep app-level JSX shells in `components/AppSurfaces.tsx`; error copy in `errors.ts`; keep visual QA using a non-blue test accent so accent regressions are visible.

## RUST ARCHITECTURE

- `display/model.rs`: DisplayInfo + luminance constants (80-480 nits)
- `display/ffi.rs`: raw Windows DisplayConfig FFI
- `display/error.rs`: structured error types (DisplayErrorCode, DisplayError)
- `display/accent.rs`: DWM registry accent-color command
- `display/service.rs`: HDR discovery, toggle, brightness logic, tests
- `display/session.rs`: AppState display cache + TrayState synchronization
- `display/commands.rs`: thin Tauri command surface
- `app/state.rs`: AppState + TrayState + TrayDisplaySummary
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
- Keep loading/error/empty/main shell JSX in `components/AppSurfaces.tsx`
- No raw `invoke()` outside `services/tauriApi.ts`
- `useDisplayDeviceActions.ts` must depend on `useDisplayCommandClient.ts`, not `services/tauriApi.ts`
- Keep display selection/refs in `useDisplayStateStore.ts` and display loading/error/notice state in `useDisplayFeedbackState.ts`
- Use Fluent UI v9 for Slider, Switch, Button, and Provider
- System accent must flow through Rust registry read -> `useAccentColor()` -> CSS vars + Fluent theme
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
- Formal release publishing uses the fixed `release` tag and stable asset filenames without version suffixes

## CRITICAL NOTES

- SDR white level range: **80-480 nits** (fixed)
- SDR White Level is the brightness control path; MCCS brightness range is not used for display enumeration
- `DisplayInfo` distinguishes `hdr_supported` from `hdr_enabled`
- Display enumeration returns HDR-capable displays even when HDR is off
- Rust owns authoritative display state; frontend consumes command results
- Tray rendering uses `TrayState`/`TrayDisplaySummary` not full `DisplayInfo`
- Display cache updates and tray refresh coordination are centralized in `display/session.rs`
- SET SDR white level uses undocumented device info type `0xFFFFFFEE`
- HDR toggle uses `DISPLAYCONFIG_SET_ADVANCED_COLOR_STATE` + brief polling
- **Per-display failure tracking**: failures are tracked per-display (via `DisplayKey`), not globally. A display is skipped after 3 consecutive failures, but recovers on next successful query.
- Tray menu must be set before right-click; do not use `popup_menu()`
- Each tray-show triggers silent display-state refresh (no startup overlay replay)
- Hotkeys: 4% step; mouse wheel on slider: 2% step
- SDR brightness controls disabled while HDR is off
- Non-blocking failures: auto-dismissing notice banner; init failures: blocking
- **Single instance**: `tauri-plugin-single-instance` prevents multiple app instances; second instance focuses existing window
- **Structured errors**: FFI/service/commands use `DisplayError`; commands return `{ code: DisplayErrorCode, message: string }` for precise frontend error handling
- **System accent**: Windows accent color is read from `HKCU\SOFTWARE\Microsoft\Windows\DWM\AccentColor`; the window refreshes it before every show.
- **UI baseline**: Acrylic transparent shell + Fluent UI v9 controls + system accent hover/active/focus states + 4-8px control radius.
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

# HDR Toolbox - Knowledge Base

**Generated:** 2026-03-29 (refreshed after custom hotkeys and step tuning)
**Type:** Rust + Tauri 2 (Windows desktop app)

## OVERVIEW

Windows system tray app for HDR monitor SDR brightness control via Windows DisplayConfig API. Rust FFI backend + React/TypeScript frontend bundled by Tauri 2.

## STRUCTURE

```text
./
|- src/
|  |- App.tsx                  # Frontend composition layer
|  |- main.tsx                 # React mount + close-to-hide handler
|  |- styles.css               # Windows 11 Mica / glass UI
|  |- types.ts                 # Shared frontend types and constants
|  |- types.test.ts            # Frontend pure conversion tests
|  |- tauriApi.ts              # Backward-compatible re-export
|  |- components/
|  |  |- TitleBar.tsx
|  |  |- DeviceNav.tsx
|  |  |- BrightnessSlider.tsx
|  |  |- StatusBar.tsx
|  |  |- SettingsDialog.tsx
|  |  |- AboutDialog.tsx
|  |  '- StartupInfoDialog.tsx
|  |- hooks/
|  |  |- useDisplays.ts
|  |  |- useHotkeys.ts
|  |  |- useWindowPosition.ts
|  |  |- useStartupOverlay.ts
|  |  |- displayState.ts       # Pure display-state helpers
|  |  '- displayState.test.ts  # Frontend display-state tests
|  '- services/
|     '- tauriApi.ts           # Typed Tauri invoke wrappers
|- src-tauri/
|  |- src/
|  |  |- main.rs               # Binary entry: calls lib::run()
|  |  |- lib.rs                # Tauri builder, plugin setup, AppState
|  |  |- tray.rs               # System tray: icon, menu, click handlers
|  |  '- display/
|  |     |- mod.rs             # Display module exports
|  |     |- model.rs           # DisplayInfo + luminance constants
|  |     |- ffi.rs             # Raw Windows DisplayConfig / MCCS calls
|  |     |- service.rs         # HDR enumeration + brightness business logic + tests
|  |     '- commands.rs        # Tauri commands for display operations
|  |- Cargo.toml               # Tauri 2, windows-rs 0.62, window-vibrancy
|  '- tauri.conf.json          # Window: 300x200, frameless, transparent
|- package.json
|- vite.config.ts
'- tsconfig.json
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Frontend composition | `src/App.tsx` | Wires hooks + components |
| Tauri API boundary | `src/services/tauriApi.ts` | Only place that should call `invoke()` |
| Display state flow | `src/hooks/useDisplays.ts` | Initial load, refresh, apply brightness |
| Display state helpers | `src/hooks/displayState.ts` | Pure helper logic for selection and updates |
| Hotkey registration | `src/hooks/useHotkeys.ts` + `src/hotkeys.ts` | JS plugin side, user-configurable accelerators |
| Window position / drag | `src/hooks/useWindowPosition.ts` | Saved position + tray positioning |
| Startup overlay | `src/hooks/useStartupOverlay.ts` | 4s startup info + Rust sync |
| Error mapping | `src/errors.ts` | User-facing initialization, refresh, and brightness messages |
| Raw DisplayConfig FFI | `src-tauri/src/display/ffi.rs` | GET/SET SDR white level + MCCS |
| Display service logic | `src-tauri/src/display/service.rs` | HDR enumeration, fallback, kill switch |
| Display command boundary | `src-tauri/src/display/commands.rs` | `#[tauri::command]` wrappers |
| Tray management | `src-tauri/src/tray.rs` | Dynamic menu, tooltip, click handlers |
| Blur-to-hide | `src-tauri/src/lib.rs` | `on_window_event(Focused(false))` |

## FRONTEND ARCHITECTURE

- `components/`: presentational UI only
- `hooks/`: stateful logic and side effects
- `services/`: typed Tauri bridge
- `types.ts`: shared constants and conversion helpers
- `*.test.ts`: Node test runner coverage for pure frontend logic

### Key frontend rules

- Do not scatter raw `invoke()` calls outside `src/services/tauriApi.ts`
- Keep tray/window/autostart side effects in hooks, not UI components
- Keep display switching, refresh, and brightness logic in `useDisplays`
- Keep global shortcut registration in `useHotkeys`
- Keep pure helper logic in separately testable modules when possible
- Keep user-facing error wording in `src/errors.ts`, not inline in UI components

## RUST ARCHITECTURE

- `display/model.rs`: shared display model and luminance constants
- `display/ffi.rs`: raw Windows FFI and monitor-handle lifecycle
- `display/service.rs`: HDR display discovery, brightness business logic, failure-state helpers, tests
- `display/commands.rs`: stable Tauri command surface
- `tray.rs`: tray UI and tray-to-frontend event bridge
- `lib.rs`: app state, plugin setup, non-display commands

## CONVENTIONS

### Rust
- `Result<T, String>` for Tauri commands
- No `anyhow` / `thiserror`
- Use `display::model::luminance::*` instead of hardcoded luminance values
- Keep undocumented DisplayConfig details inside `display/ffi.rs`
- Keep pure service logic testable without touching Windows APIs when possible

### Frontend
- React hooks only
- No router
- Keep `App.tsx` as composition, not business logic dumping ground
- Use `src/types.ts` for constants and shared types
- Use `src/services/tauriApi.ts` for Rust commands
- Exclude `*.test.ts` from production TypeScript build

### Tauri 2
- `tray-icon` + `image-png` features
- JS-side global shortcut registration
- JS-side autostart enable/disable/isEnabled
- Rust-side blur-to-hide for frameless window reliability

## CRITICAL NOTES

- SDR white level range is fixed to **80-480 nits**
- MCCS brightness is informational only; SDR White Level is the actual control path
- SET SDR white level uses undocumented device info type `0xFFFFFFEE`
- The custom SET struct requires `final_value = 1`
- Tray menu must be set before right-click; do not use `popup_menu()`
- `tauri://blur` is intentionally not used
- The title bar includes a manual refresh button beside the settings button
- Each time the window is shown from the tray, the frontend performs a **silent refresh** of display state without replaying the startup overlay
- Global brightness hotkeys are user-configurable and use a 4% step
- The brightness slider supports mouse-wheel adjustment while the pointer is over the slider track with a 2% step
- Non-blocking failures use an auto-dismissing notice banner; initialization failures still use a blocking full-page error state

## COMMANDS

```bash
npm run tauri dev
npm run tauri build
npm run build
npm test
cd src-tauri && cargo check
```

## BUILD STATUS

- Frontend build passes
- Rust `cargo check` passes
- Frontend Node tests pass
- Rust unit tests pass

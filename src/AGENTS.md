# Frontend - React/TypeScript UI Layer

**Parent:** ./AGENTS.md
**Generated:** 2026-04-01

## OVERVIEW

React 18 single-window UI for HDR brightness control. Frontend is split into composition, hooks, services, presentational components, and Node-based tests for pure logic.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| App wiring | `App.tsx` | Composes hooks and components |
| App-level control | `app/useAppController.ts` | Init, tray events, autostart, dialogs, quit |
| Brightness control | `brightness/useBrightnessController.ts` | Slider drag, commit, wheel |
| Display facade | `hooks/useDisplays.ts` | Public display-state hook |
| Display selection | `hooks/useDisplaySelection.ts` | Selected display, percentage, HDR-active |
| Display actions | `hooks/useDisplayDeviceActions.ts` | Refresh, brightness, HDR toggle |
| Hotkeys | `hooks/useHotkeys.ts` + `hotkeys.ts` | Global shortcut registration |
| Window position | `hooks/useWindowPosition.ts` | Tray placement + saved position |
| Rust bridge | `services/tauriApi.ts` | Only place calling `invoke()` |
| Contract checks | `displayContract.test.ts` | TS/Rust DisplayInfo drift detection |

## RULES

- No raw `invoke()` outside `services/tauriApi.ts`
- `App.tsx` is composition only, not business logic
- `types.ts` is the only place for shared frontend constants
- `DisplayInfo.hdr_supported` ≠ `DisplayInfo.hdr_enabled` — stay aligned with Rust
- Pure logic goes in helper modules before hooks
- Error copy centralized in `errors.ts`

## UI RULES

- `StatusBar` HDR toggle must refresh state after change
- SDR controls disabled when `hdr_enabled` is `false`
- Frontend consumes Rust-owned state; no push sync paths

## TEST COVERAGE

- `types.test.ts`: nits/percentage conversion
- `displayContract.test.ts`: TS/Rust contract checks
- `hooks/displayState.test.ts`: selection/update helpers
- `errors.test.ts`: error mapping
- `hotkeys.test.ts`: hotkey formatting/validation

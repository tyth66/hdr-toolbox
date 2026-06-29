# Frontend - React/TypeScript UI Layer

**Parent:** ./AGENTS.md
**Generated:** 2026-06-29

## OVERVIEW

React 18 single-window UI for HDR brightness control. Frontend is split into composition, hooks, services, presentational components, and Node-based tests for pure logic.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| App wiring | `App.tsx` | Composes hooks and components |
| App render surfaces | `components/AppSurfaces.tsx` | Loading, error, empty, and main shell JSX |
| App-level control | `app/useAppController.ts` | Init, tray events, autostart, dialogs, quit |
| Brightness control | `brightness/useBrightnessController.ts` | Slider drag, commit, wheel |
| Display facade | `hooks/useDisplays.ts` | Public display-state hook |
| Display state store | `hooks/useDisplayStateStore.ts` | Selected display, refs, percentage, HDR-active |
| Display command client | `hooks/useDisplayCommandClient.ts` | Display-command adapter over typed Tauri wrappers |
| Display feedback state | `hooks/useDisplayFeedbackState.ts` | Loading, refreshing, HDR pending, errors, notices |
| Display actions | `hooks/useDisplayDeviceActions.ts` | Refresh, brightness, HDR toggle orchestration |
| Hotkeys | `hooks/useHotkeys.ts` + `hotkeys.ts` | Global shortcut registration |
| Window position | `hooks/useWindowPosition.ts` | Tray placement + saved position |
| Rust bridge | `services/tauriApi.ts` | Only place calling `invoke()` |
| Contract checks | `displayContract.test.ts` | TS/Rust DisplayInfo drift detection |

## RULES

- No raw `invoke()` outside `services/tauriApi.ts`
- `useDisplayDeviceActions.ts` must use `useDisplayCommandClient.ts`, not import Tauri services directly
- `useDisplays.ts` composes display state, feedback, commands, and actions; keep it as the public facade
- `App.tsx` is composition only, not business logic
- Keep app-level render shells in `components/AppSurfaces.tsx`
- `types.ts` is the only place for shared frontend constants
- `DisplayInfo.hdr_supported` ≠ `DisplayInfo.hdr_enabled` — stay aligned with Rust
- Pure logic goes in helper modules before hooks
- Error copy centralized in `errors.ts`

## UI RULES

- `StatusBar` HDR toggle flips brightness source via `flip_hdr_source_in_cache`; when HDR is off on an HDR-capable DDC display, shows DDC source label instead of "HDR Off"
- Slider disabled only during HDR pending state; HDR-off no longer disables slider (DDC fallback handles it)
- Frontend consumes Rust-owned state; no push sync paths

## TEST COVERAGE

- `types.test.ts`: nits/percentage conversion
- `displayContract.test.ts`: TS/Rust contract checks
- `architectureContract.test.ts`: frontend/Rust boundary checks
- `visualContract.test.ts`: visual implementation contract checks
- `hooks/displayState.test.ts`: selection/update helpers
- `hooks/syncBrightnessOutcome.test.ts`: synced brightness outcome handling
- `errors.test.ts`: error mapping
- `hotkeys.test.ts`: hotkey formatting/validation

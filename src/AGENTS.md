# Frontend - React/TypeScript UI Layer

**Parent:** ./AGENTS.md
**Generated:** 2026-06-29

## OVERVIEW

React 18 single-window UI for universal brightness control across HDR SDR, DDC/CI, and WMI sources. Frontend is split into composition, hooks, services, presentational components, and Node-based tests for pure logic.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| App wiring | `App.tsx` | Composes hooks and components |
| App render surfaces | `components/AppSurfaces.tsx` | Loading, error, empty, and main shell JSX |
| App render surface exports | `components/AppSurfaces.tsx` | Barrel export for state shells and main shell |
| App state shells | `components/AppStateSurfaces.tsx` | Loading, error, and empty JSX |
| Main shell | `components/MainSurface.tsx` | Main display/settings/about/startup shell with grouped props |
| App-level control | `app/useAppController.ts` | Composition over focused app controllers and window-focus state refresh |
| Dialog control | `app/useDialogController.ts` | Settings/about dialog state |
| Settings control | `app/useSettingsController.ts` | Autostart, sync brightness, and theme preference |
| Hotkey control | `app/useHotkeyController.ts` | Hotkey recording, validation, persistence, and registration |
| Tray events | `app/useTrayDisplayEvents.ts` | Initial display load and Tauri tray wake state refresh |
| Brightness control | `brightness/useBrightnessController.ts` | Slider drag, commit, wheel |
| Brightness capability | `brightness/brightnessCapability.ts` | Source-aware slider adjustability rule |
| Brightness interaction | `brightness/brightnessInteraction.ts` | Pure wheel-step brightness math |
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
- Keep `components/AppSurfaces.tsx` as a re-export barrel; app-level state shells live in `components/AppStateSurfaces.tsx` and the main shell lives in `components/MainSurface.tsx`
- Keep `app/useAppController.ts` as a composition hook; put dialogs, settings, hotkeys, and tray events in their focused controller hooks
- `types.ts` is the only place for shared frontend constants
- `DisplayInfo.hdr_supported` ≠ `DisplayInfo.hdr_enabled` — stay aligned with Rust
- Pure logic goes in helper modules before hooks
- Error copy centralized in `errors.ts`

## UI RULES

- `StatusBar` HDR toggle flips brightness source; shows fallback source label (DDC or WMI) when HDR is off
- Slider adjustability uses `brightness/brightnessCapability.ts`: HDR SDR requires HDR active; DDC/WMI sources remain adjustable when HDR is off; HDR-pending blocks all sources
- Frontend consumes Rust-owned state; no push sync paths
- Tray wake and window focus use known-device state refresh; if HDR remains off and the active source is already DDC/WMI, refresh must keep that source. Manual refresh remains full provider discovery.
- Only manual refresh should animate the title-bar refresh button; silent tray/focus known-state refreshes must not set `isRefreshing`.
- `silent: true` still allows non-blocking refresh error notices through `mapRefreshError`, but it must not trigger loading/startup state or the visible title-bar refresh indicator.

## TEST COVERAGE

- `types.test.ts`: nits/percentage conversion
- `brightness/brightnessCapability.test.ts`: source-aware brightness adjustability
- `brightness/brightnessInteraction.test.ts`: wheel-step brightness behavior
- `displayContract.test.ts`: TS/Rust contract checks
- `architectureContract.test.ts`: frontend/Rust boundary checks
- `visualContract.test.ts`: visual implementation contract checks
- `hooks/displayState.test.ts`: selection/update helpers
- `hooks/syncBrightnessOutcome.test.ts`: synced brightness outcome handling
- `errors.test.ts`: error mapping
- `hotkeys.test.ts`: hotkey formatting/validation

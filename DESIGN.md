# Design

## Status

- Status: Active
- Last refreshed: 2026-06-30
- Product: BrightBox, a fixed-size Windows tray utility controlling display brightness across HDR SDR white level, DDC/CI, and internal WMI panel paths. HDR toggle flips between SDR white level and physical brightness on the same display entry.
- Primary surfaces:
  - 300 x 200 tray flyout
  - Display rail
  - Brightness slider
  - HDR status and switch
  - Settings, about, startup, loading, empty, error, and notice states

This file is the current UI source of truth. Do not revive deleted one-off phase plans or QA reports.

## Implementation Status

- Current user-visible brightness paths: HDR SDR white level via DisplayConfig, DDC/CI high-level/VCP brightness, and internal-panel WMI brightness.
- Universal brightness model status: shared Rust/TypeScript `DisplayInfo` now includes `BrightnessSource`, normalized `brightness`, `brightness_raw`, `brightness_raw_max`, `brightness_device_id`, and `brightness_vcp_code`.
- Backend routing foundation: `src-tauri/src/display/brightness.rs` owns pure HDR SDR percent/nits conversion, DDC raw scaling, and `BrightnessSource` to hardware-value selection helpers.
- Provider failure contract: Rust and TypeScript now share DDC/WMI enumeration and brightness error codes, with frontend notices forwarding structured provider messages.
- Provider boundary contract: `display/ddcci.rs` and `display/wmi.rs` own their Windows provider APIs, and architecture tests reserve physical monitor APIs for DDC/CI and WMI APIs for the WMI module.
- DDC/CI provider foundation: `display/ddcci.rs` has tested VCP priority selection, DDC raw-to-percent conversion, percent-to-raw conversion, Windows physical monitor enumeration, high-level brightness read/write, and VCP read/write.
- WMI provider foundation: `display/wmi.rs` has tested instance-name parsing and brightness clamping, native COM connection to `ROOT\WMI`, `WmiMonitorBrightness` enumeration, and `WmiMonitorBrightnessMethods.WmiSetBrightness` writes.
- WMI runtime robustness: `display/wmi.rs` tolerates `RPC_E_CHANGED_MODE` from `CoInitializeEx` so WMI can run when Tauri/WebView has already initialized COM on the thread.
- Provider merge foundation: `display/service.rs` now merges HDR SDR, DDC/CI, and WMI provider results into one `DisplayInfo` list while preserving `HdrSdr > DDC > WMI` precedence. DDC/CI merge first matches the DisplayConfig monitor device path against the DDC physical-monitor key with its physical index removed, then falls back to exact-name matching for older paths. When a matched HDR display is enumerated while HDR is off, the active `brightness_source` is immediately switched to the provider fallback and `brightness` uses that provider's current percentage.
- Backend write routing: `display/commands.rs` looks up cached `DisplayInfo` entries and `display/service.rs` routes writes to DisplayConfig HDR SDR, DDC/CI high-level, DDC/CI VCP, or WMI based on `BrightnessSource`.
- Frontend state status: display-state hooks now use normalized `brightness`, brightness preview updates only change HDR SDR `nits` for `hdr_sdr`, and the action layer no longer blocks brightness writes only because HDR is off.
- HDR/DDC/WMI source switching: `DisplayInfo.fallback_source` stores the alternate brightness source for HDR-capable displays. When HDR is off, either toggle handling or full discovery flips the active source from `HdrSdr` to `DdcHighLevel`/`DdcVcp`/`Wmi` so the slider controls physical brightness. Re-reading state while HDR remains off must keep the provider source active instead of flipping back to `HdrSdr`; when HDR is turned back on, it flips back to `HdrSdr`. A single display entry serves all paths; duplicate entries are avoided by provider identity matching before display-name fallback.
- HDR toggle no longer triggers full re-enumeration; `flip_hdr_source_in_cache` swaps `brightness_source` and `fallback_source` in the Rust cache directly.
- Known-device refresh: `refresh_known_display_state` reads the active source for cached display identities on tray wake/window focus, updates brightness/HDR state, and falls back to full discovery only when a cached identity can no longer be read.
- Component surface status: `BrightnessSlider`, `StatusBar`, and `AppSurfaces` are source-aware; HDR SDR displays with fallback (DDC or WMI) are never disabled; the slider always works and HDR toggle flips the active source. Displays without any fallback show the disabled state when HDR is off.
- Tray status: `TrayDisplaySummary` stores generic brightness percentage plus `BrightnessSource`, and tray tooltip/menu text uses percentage summaries instead of HDR-only nits.
- UI implication: keep compact tray-flyout density while source-specific labels describe the active `BrightnessSource`.
- Frontend tooling status: Bun `1.3.14` owns package installation, script execution, and frontend tests; Vite remains the frontend dev server and production frontend bundler for Tauri. Bun bundler and Vite+ are intentionally not adopted in the current release path.

## Refresh Model

| Trigger | Rust command | Hardware work | UI feedback |
| --- | --- | --- | --- |
| Initial load | `get_hdr_displays` | Full HDR, DDC/CI, and WMI discovery | Loading/startup overlay |
| Title-bar refresh button | `get_hdr_displays` | Full HDR, DDC/CI, and WMI discovery | Refresh indicator spins |
| Tray wake | `refresh_known_display_state` | Read cached display HDR state and active brightness source | Silent |
| Window focus | `refresh_known_display_state` | Read cached display HDR state and active brightness source | Silent |

- Manual refresh is the only routine full provider discovery path after startup.
- Tray wake and window focus are lightweight known-state refreshes. They must not re-enumerate all providers, replay startup overlay, or drive the title-bar refresh indicator.
- Known-state refresh uses the cached active source. When HDR remains off and the active source is already `DdcHighLevel`, `DdcVcp`, or `Wmi`, the source-state transition is idempotent and keeps that provider source active.
- Service fallback to `get_hdr_displays` is reserved for read failures from the known-device path. There is no extra source-state validation step that forces discovery before attempting the known read.

## Design Direction

BrightBox should feel like a native Windows 11 tray flyout: compact, translucent, quiet, and utility-first.

Use a neutral Acrylic shell, Fluent UI v9 controls, the fixed Codex accent color, visible focus states, and 4-8px control radii. Avoid website composition, dashboard density, decorative gradients, glows, marketing copy, large cards, and extra explanatory text in the main surface.

## Current Baseline

- Native shell:
  - Tauri 2 fixed 300 x 200 frameless window.
  - WebView transparency is enabled.
  - `src-tauri/src/app/window.rs` applies Windows Acrylic with a neutral tint.
- Component layer:
  - Fluent UI v9 `Provider`, `Button`, `Slider`, and `Switch`.
  - Repo CSS tokens own layout, spacing, Acrylic shell color, and Fluent override gaps.
- Theme:
  - Default preference is `System`.
  - Settings can persist `System`, `Light`, or `Dark`.
  - System light/dark follows `prefers-color-scheme`.
- Accent:
  - Frontend `useAccentColor()` applies the fixed Codex accent `#339CFF` to CSS variables and Fluent theme tokens.
  - The app refreshes accent variables before showing the tray window.
  - `#0078d4` is not used as the fallback accent.
- QA:
  - `visual-qa.html` renders production components for browser QA.
  - `src/visualQa.tsx` intentionally uses non-blue `#c38aa0` to catch default-blue regressions.
  - `src/visualContract.test.ts` protects visual implementation contracts.

## File Map

| Area | Files |
| --- | --- |
| Composition | `src/App.tsx` |
| App render surfaces | `src/components/AppSurfaces.tsx` |
| Shell CSS/tokens | `src/styles.css` |
| Fluent theme | `src/theme.ts` |
| Accent hook | `src/hooks/useAccentColor.ts` |
| System color scheme | `src/hooks/useSystemColorScheme.ts` |
| Theme persistence | `src/themePreference.ts` |
| Visual QA | `visual-qa.html`, `src/visualQa.tsx`, `src/visualQa.css` |
| Contract tests | `src/visualContract.test.ts`, `src/theme.test.ts`, `src/themePreference.test.ts` |
| Acrylic native layer | `src-tauri/src/app/window.rs`, `src-tauri/tauri.conf.json` |
| Primary components | `src/components/AppSurfaces.tsx`, `TitleBar.tsx`, `DeviceNav.tsx`, `BrightnessSlider.tsx`, `StatusBar.tsx`, `SettingsDialog.tsx` |

## Visual Rules

### Surfaces

- Main window: translucent neutral Acrylic shell.
- Dialogs: same neutral family, not separate heavy cards.
- Rail: subtle neutral layer only.
- Notices: compact overlay, readable in light and dark modes.
- Do not add opaque panels that hide the Acrylic character unless contrast requires it.

### Color

- Use one normal interaction accent: the fixed Codex accent `#339CFF`.
- Use accent for:
  - Slider progress and active thumb.
  - Checked Switch tracks.
  - Selected/hovered display icons.
  - Title-bar hover, active, and focus affordances.
  - Primary action states where appropriate.
- Do not use accent for decorative glows, large backgrounds, or competing palettes.
- HDR-on status may use a small green dot; warnings use amber; errors use red.

### Controls

- Buttons:
  - Compact icon buttons: 28 x 28px.
  - Display rail buttons: at least 32 x 32px.
  - Radius: 4-8px.
  - Hover and active states must visibly follow the fixed accent.
  - Focus-visible ring is required.
- Slider:
  - Fluent UI Slider.
  - Neutral rail plus fixed-accent progress.
  - Stable layout when disabled.
  - Mouse wheel remains 2% step.
- Switch:
  - Fluent UI Switch.
  - HDR switch may be compact, but thumb must stay inside track.
  - Auto-start, sync brightness, and HDR checked states use the fixed accent.
- Typography:
  - System font stack, no remote fonts.
  - Main brightness value is the visual anchor.
  - Keep labels short and readable at compact sizes.

## Interaction Rules

- Tray show must refresh accent variables before showing the window.
- Each tray show and window focus silently refresh known display hardware state without replaying startup overlay or re-running full provider discovery.
- Manual refresh remains the full discovery path for HDR, DDC/CI, and WMI providers.
- Only manual refresh drives the title-bar refresh indicator; tray wake and window-focus known-state refreshes are silent.
- Closing hides the window; quitting happens from tray/menu command.
- Blur-to-hide remains Rust-side for frameless reliability.
- Disabled HDR-dependent controls must remain stable in size.
- Shortcut recording must be keyboard reachable and cancellable with Escape.

## Architecture Rules

- Keep `App.tsx` as composition.
- Keep loading, error, empty, and main shell JSX in `src/components/AppSurfaces.tsx`.
- Presentational UI stays in `src/components`.
- Stateful behavior stays in hooks.
- No raw Tauri `invoke()` outside `src/services/tauriApi.ts`.
- Do not add another UI component system unless replacing Fluent UI v9 intentionally.
- Use plain CSS tokens in `src/styles.css`; keep token names stable.

## Verification

Run these after UI/theme changes:

```bash
bun run test:frontend
bun run typecheck
bun run build
```

Run full verification before release or commit batches that touch Rust:

```bash
bun run test
```

For visual changes, use `agent-browser` against:

```text
http://localhost:1420/visual-qa.html
```

Visual QA must check:

- Acrylic/translucent shell remains visible.
- Fluent Slider, Switch, and Button render correctly.
- Non-blue QA accent propagates to slider, switches, selected display, title buttons, hover states, and focus states.
- Text does not overflow compact controls.
- HDR switch thumb remains within track bounds.

## Open Questions

- Should the 300 x 200 window remain fixed if settings usability becomes constrained?
- Should synced brightness state appear on the main surface, or remain settings-only?
- Should full display names be exposed only via tooltip/title, or also through a secondary view?

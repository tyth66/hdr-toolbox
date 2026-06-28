# Design

## Status

- Status: Active
- Last refreshed: 2026-06-29
- Product: HDR Toolbox, a fixed-size Windows tray utility for HDR display SDR white-level control.
- Primary surfaces:
  - 300 x 200 tray flyout
  - Display rail
  - Brightness slider
  - HDR status and switch
  - Settings, about, startup, loading, empty, error, and notice states

This file is the current UI source of truth. Do not revive deleted one-off phase plans or QA reports.

## Design Direction

HDR Toolbox should feel like a native Windows 11 tray flyout: compact, translucent, quiet, and utility-first.

Use a neutral Acrylic shell, Fluent UI v9 controls, Windows system accent color, visible focus states, and 4-8px control radii. Avoid website composition, dashboard density, decorative gradients, glows, marketing copy, large cards, and extra explanatory text in the main surface.

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
  - Rust reads `HKCU\SOFTWARE\Microsoft\Windows\DWM\AccentColor`.
  - Frontend `useAccentColor()` applies the value to CSS variables and Fluent theme tokens.
  - The app refreshes accent color before showing the tray window.
  - `#0078d4` is fallback only.
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
| Accent native command | `src-tauri/src/display/accent.rs` |
| Primary components | `src/components/AppSurfaces.tsx`, `TitleBar.tsx`, `DeviceNav.tsx`, `BrightnessSlider.tsx`, `StatusBar.tsx`, `SettingsDialog.tsx` |

## Visual Rules

### Surfaces

- Main window: translucent neutral Acrylic shell.
- Dialogs: same neutral family, not separate heavy cards.
- Rail: subtle neutral layer only.
- Notices: compact overlay, readable in light and dark modes.
- Do not add opaque panels that hide the Acrylic character unless contrast requires it.

### Color

- Use one normal interaction accent: the current Windows system accent.
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
  - Hover and active states must visibly follow system accent.
  - Focus-visible ring is required.
- Slider:
  - Fluent UI Slider.
  - Neutral rail plus system-accent progress.
  - Stable layout when disabled.
  - Mouse wheel remains 2% step.
- Switch:
  - Fluent UI Switch.
  - HDR switch may be compact, but thumb must stay inside track.
  - Auto-start, sync brightness, and HDR checked states use system accent.
- Typography:
  - System font stack, no remote fonts.
  - Main brightness value is the visual anchor.
  - Keep labels short and readable at compact sizes.

## Interaction Rules

- Tray show must refresh system accent before showing the window.
- Each tray show also silently refreshes display state without replaying startup overlay.
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
npm run test:frontend
npm run typecheck
npm run build
```

Run full verification before release or commit batches that touch Rust:

```bash
npm test
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

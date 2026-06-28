import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const srcDir = path.dirname(__filename);
const repoRoot = path.resolve(srcDir, "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.resolve(repoRoot, relativePath), "utf8");
}

function extractCssRule(styles: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`${escapedSelector}\\s*\\{[^}]*\\}`));
  assert.ok(match?.[0], `Could not locate CSS rule for ${selector}`);
  return match[0];
}

test("desktop theme uses local system fonts and avoids decorative blue glow", () => {
  const styles = readRepoFile("src/styles.css");

  assert.doesNotMatch(styles, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.doesNotMatch(styles, /text-shadow\s*:/);
  assert.doesNotMatch(styles, /box-shadow:\s*0\s+0\s+\d+px\s+rgba\(0,\s*120,\s*212/i);
});

test("native Acrylic backdrop remains visible through transparent app layers", () => {
  const app = readRepoFile("src/App.tsx");
  const visualQa = readRepoFile("src/visualQa.tsx");
  const styles = readRepoFile("src/styles.css");
  const windowConfig = readRepoFile("src-tauri/src/app/window.rs");
  const tauriConfig = JSON.parse(readRepoFile("src-tauri/tauri.conf.json")) as {
    app?: { windows?: Array<{ transparent?: boolean }> };
  };

  assert.equal(tauriConfig.app?.windows?.[0]?.transparent, true);
  assert.match(windowConfig, /apply_acrylic/);
  assert.match(windowConfig, /apply_acrylic\(&window,\s*None\)/);
  assert.doesNotMatch(windowConfig, /ACRYLIC_TINT/);
  assert.doesNotMatch(windowConfig, /apply_mica/);
  assert.match(app, /<FluentProvider className="fluent-root"/);
  assert.match(visualQa, /<FluentProvider className="fluent-root"/);
  const fluentRootRule = extractCssRule(styles, ".fluent-root");
  const micaWindowRule = extractCssRule(styles, ".mica-window");
  const sideNavRule = extractCssRule(styles, ".side-nav");
  const dialogOverlayRule = extractCssRule(styles, ".dialog-overlay");
  assert.match(fluentRootRule, /background:\s*transparent/);
  assert.match(styles, /--acrylic-window-tint:\s*rgba\(20,\s*20,\s*20,\s*0\.34\)/);
  assert.match(styles, /\.app-theme-light\s*\{[\s\S]*--acrylic-window-tint:\s*rgba\(250,\s*250,\s*250,\s*0\.44\)/);
  assert.match(styles, /--dialog-overlay-bg:\s*rgba\(0,\s*0,\s*0,\s*0\.34\)/);
  assert.match(styles, /\.app-theme-light\s*\{[\s\S]*--dialog-overlay-bg:\s*rgba\(255,\s*255,\s*255,\s*0\.22\)/);
  assert.match(micaWindowRule, /background:\s*var\(--acrylic-window-tint\)/);
  assert.doesNotMatch(micaWindowRule, /background:\s*var\(--color-window\)/);
  assert.match(dialogOverlayRule, /background:\s*var\(--dialog-overlay-bg\)/);
  assert.doesNotMatch(dialogOverlayRule, /background:\s*rgba\(0,\s*0,\s*0,\s*0\.34\)/);
  assert.match(styles, /--color-surface:\s*rgba\(255,\s*255,\s*255,\s*0\.055\)/);
  assert.match(sideNavRule, /background:\s*rgba\(0,\s*0,\s*0,\s*0\.08\)/);
});

test("minimal title bar close uses the shared close icon treatment", () => {
  const titleBar = readRepoFile("src/components/TitleBar.tsx");

  assert.doesNotMatch(titleBar, />\s*x\s*<\/button>/);
  assert.match(titleBar, /minimal[\s\S]*<DismissRegular \/>/);
});

test("interactive controls use Fluent UI Button with built-in focus handling", () => {
  const titleBar = readRepoFile("src/components/TitleBar.tsx");
  const styles = readRepoFile("src/styles.css");

  assert.match(titleBar, /import.*Button.*from.*@fluentui/);
  assert.match(titleBar, /appearance="subtle"/);
  assert.match(styles, /\.fluent-root \.title-bar-btn:not\(:disabled\):hover\s*\{[\s\S]*color:\s*var\(--win-blue\)\s*!important/);
  assert.match(styles, /\.fluent-root \.title-bar-btn:not\(:disabled\):hover svg,\s*[\r\n]+\.fluent-root \.title-bar-btn:not\(:disabled\):hover svg \*\s*\{[\s\S]*fill:\s*currentColor\s*!important/);
  assert.match(styles, /\.fluent-root \.title-bar-btn:focus-visible\s*\{[\s\S]*outline:\s*2px solid color-mix\(in srgb, var\(--win-blue\)/);
});

test("display navigation icon hover and selected state use system accent", () => {
  const deviceNav = readRepoFile("src/components/DeviceNav.tsx");
  const styles = readRepoFile("src/styles.css");

  assert.match(deviceNav, /className=\{`side-nav-btn \$\{selectedIndex === idx \? "active" : ""\}`\}/);
  assert.match(styles, /\.fluent-root \.side-nav-btn:hover,\s*[\r\n]+\.fluent-root \.side-nav-btn\.active\s*\{[\s\S]*color:\s*var\(--win-blue\)\s*!important/);
  assert.match(styles, /\.fluent-root \.side-nav-btn:hover svg,[\s\S]*\.fluent-root \.side-nav-btn\.active svg \*\s*\{[\s\S]*stroke:\s*currentColor\s*!important/);
  assert.match(styles, /\.fluent-root \.side-nav-btn:focus-visible\s*\{[\s\S]*outline:\s*2px solid color-mix\(in srgb, var\(--win-blue\)/);
});

test("main brightness surface shows the selected display name", () => {
  const appSurfaces = readRepoFile("src/components/AppSurfaces.tsx");
  const brightnessSlider = readRepoFile("src/components/BrightnessSlider.tsx");
  const styles = readRepoFile("src/styles.css");
  const contentRule = extractCssRule(styles, ".content");
  const sliderSectionRule = extractCssRule(styles, ".slider-section");
  const brightnessSliderRule = extractCssRule(styles, ".brightness-slider-control");

  assert.match(brightnessSlider, /displayName:\s*string/);
  assert.match(brightnessSlider, /className="display-name"/);
  assert.match(brightnessSlider, /title=\{displayName\}/);
  assert.match(brightnessSlider, /className="brightness-slider-control"/);
  assert.match(appSurfaces, /displayName=\{selectedDisplay\?\.name \?\? "Unknown display"\}/);
  assert.match(styles, /\.content\s*\{[\s\S]*min-width:\s*0/);
  assert.match(styles, /\.slider-section\s*\{[\s\S]*min-width:\s*0/);
  assert.match(styles, /\.display-name\s*\{[\s\S]*max-width:\s*100%/);
  assert.match(contentRule, /justify-content:\s*flex-start/);
  assert.match(contentRule, /gap:\s*12px/);
  assert.match(sliderSectionRule, /gap:\s*2px/);
  assert.match(brightnessSliderRule, /--fui-Slider__rail--size:\s*2px/);
  assert.match(brightnessSliderRule, /--fui-Slider__thumb--size:\s*14px/);
  assert.match(styles, /\.fluent-root \.brightness-slider-control:not\(:has\(input:disabled\)\)\s*\{[\s\S]*--fui-Slider__progress--color:\s*var\(--win-blue\)/);
  assert.match(styles, /\.fluent-root \.brightness-slider-control:not\(:has\(input:disabled\)\) \.fui-Slider__thumb\s*\{[\s\S]*background-color:\s*var\(--win-blue\)/);
  assert.match(styles, /\.brightness-slider-control \.fui-Slider__rail::before\s*\{[\s\S]*display:\s*none/);
});

test("Fluent switches use system accent and compact HDR thumb stays inside track", () => {
  const statusBar = readRepoFile("src/components/StatusBar.tsx");
  const settingsDialog = readRepoFile("src/components/SettingsDialog.tsx");
  const styles = readRepoFile("src/styles.css");
  const visualQa = readRepoFile("src/visualQa.tsx");

  assert.match(statusBar, /className="accent-switch status-switch"/);
  assert.match(settingsDialog, /className="accent-switch settings-switch"/);
  assert.match(styles, /\.fluent-root \.accent-switch \.fui-Switch__input:checked ~ \.fui-Switch__indicator\s*\{[\s\S]*background-color:\s*var\(--switch-accent\)/);
  assert.match(styles, /\.fluent-root \.status-switch \.fui-Switch__indicator svg\s*\{[\s\S]*width:\s*12px[\s\S]*height:\s*12px/);
  assert.match(styles, /\.fluent-root \.status-switch \.fui-Switch__input:checked ~ \.fui-Switch__indicator svg\s*\{[\s\S]*transform:\s*translateX\(16px\)/);
  assert.match(visualQa, /const VISUAL_QA_ACCENT = "#c38aa0"/);
  assert.doesNotMatch(visualQa, /const VISUAL_QA_ACCENT = "#0078d4"/);
});

test("main surface has a compact notice and rail uses Fluent UI Button", () => {
  const styles = readRepoFile("src/styles.css");
  const deviceNav = readRepoFile("src/components/DeviceNav.tsx");

  assert.match(styles, /\.notice-banner\s*\{[\s\S]*position:\s*absolute/);
  assert.match(styles, /\.notice-copy span\s*\{[\s\S]*-webkit-line-clamp:\s*2/);
  assert.match(deviceNav, /import.*Button.*from.*@fluentui/);
  assert.match(deviceNav, /appearance="subtle"/);
});

test("settings dialog is grouped and accessible", () => {
  const settingsDialog = readRepoFile("src/components/SettingsDialog.tsx");
  const styles = readRepoFile("src/styles.css");

  for (const heading of ["Startup", "Appearance", "Brightness", "Shortcuts", "About"]) {
    assert.match(settingsDialog, new RegExp(`<h3 className="settings-heading"[^>]*>${heading}</h3>`));
  }

  assert.match(settingsDialog, /role="radiogroup"/);
  assert.match(settingsDialog, /aria-label="Theme"/);
  assert.match(settingsDialog, /aria-checked=\{themePreference === option\.value\}/);
  assert.match(settingsDialog, /aria-label="Toggle auto-start"/);
  assert.match(settingsDialog, /aria-label="Toggle synced brightness"/);
  assert.doesNotMatch(settingsDialog, /v1\.0\.0/);
  assert.match(styles, /\.settings-group\s*\{/);
  assert.match(styles, /\.settings-heading\s*\{/);
  assert.match(styles, /\.settings-footer\s*\{/);
  assert.match(styles, /\.theme-segmented\s*\{/);
  assert.match(styles, /\.shortcut-btn\s*\{[\s\S]*width:\s*118px/);
});

test("theme preference can override system color scheme", () => {
  const app = readRepoFile("src/App.tsx");
  const useAppController = readRepoFile("src/app/useAppController.ts");
  const useAccentColor = readRepoFile("src/hooks/useAccentColor.ts");
  const settingsDialog = readRepoFile("src/components/SettingsDialog.tsx");
  const styles = readRepoFile("src/styles.css");
  const theme = readRepoFile("src/theme.ts");

  assert.match(useAppController, /loadThemePreference/);
  assert.match(useAppController, /saveThemePreference/);
  assert.match(useAccentColor, /refreshAccentColor/);
  assert.match(useAccentColor, /getSystemAccentColor/);
  assert.match(app, /resolveEffectiveThemePreference/);
  assert.match(app, /const \{ accentColor, refreshAccentColor \} = useAccentColor\(\)/);
  assert.match(app, /showWindowWithAccentRefresh/);
  assert.match(app, /const showWindowWithAccentRefresh = useCallback\(async \(\) => \{[\s\S]*await refreshAccentColor\(\);[\s\S]*await showWindow\(\);/);
  assert.match(app, /app-theme-\$\{effectiveThemePreference\}/);
  assert.match(app, /createSystemAccentTheme/);
  assert.match(app, /webDarkTheme/);
  assert.match(app, /webLightTheme/);
  assert.match(app, /createSystemAccentTheme\(baseFluentTheme, accentColor\)/);
  assert.match(settingsDialog, /themePreference/);
  assert.match(settingsDialog, /onChangeThemePreference/);
  assert.match(styles, /\.app-theme-light\s*\{/);
  assert.match(styles, /\.app-theme-dark\s*\{/);
  assert.match(theme, /colorBrandBackground/);
  assert.match(theme, /colorCompoundBrandStrokePressed/);
  assert.doesNotMatch(theme, /webDarkTheme|webLightTheme/);
});

test("settings and notice actions use Fluent UI Button instead of raw buttons", () => {
  const app = readRepoFile("src/App.tsx");
  const appSurfaces = readRepoFile("src/components/AppSurfaces.tsx");
  const settingsDialog = readRepoFile("src/components/SettingsDialog.tsx");
  const visualQa = readRepoFile("src/visualQa.tsx");

  assert.match(app, /import \{[\s\S]*FluentProvider,[\s\S]*webDarkTheme,/);
  assert.match(appSurfaces, /import \{[\s\S]*Button[\s\S]*\} from "@fluentui\/react-components"/);
  assert.match(appSurfaces, /<Button[\s\S]*className="notice-dismiss"/);
  assert.doesNotMatch(appSurfaces, /<button[\s\S]*className="notice-dismiss"/);

  assert.match(settingsDialog, /<Button[\s\S]*className=\{`theme-option/);
  assert.match(settingsDialog, /<Button[\s\S]*className=\{`btn shortcut-btn/);
  assert.doesNotMatch(settingsDialog, /<button/);

  assert.match(visualQa, /<Button[\s\S]*className="notice-dismiss"/);
  assert.doesNotMatch(visualQa, /<button[\s\S]*className="notice-dismiss"/);
});

test("secondary states use a shared dialog and state shell", () => {
  const aboutDialog = readRepoFile("src/components/AboutDialog.tsx");
  const settingsDialog = readRepoFile("src/components/SettingsDialog.tsx");
  const startupDialog = readRepoFile("src/components/StartupInfoDialog.tsx");
  const appSurfaces = readRepoFile("src/components/AppSurfaces.tsx");
  const styles = readRepoFile("src/styles.css");

  for (const dialog of [aboutDialog, settingsDialog, startupDialog]) {
    assert.match(dialog, /className="dialog-overlay"/);
    assert.match(dialog, /className="dialog-shell"/);
  }

  assert.doesNotMatch(startupDialog, /style=\{\{/);
  assert.match(appSurfaces, /className="app-state app-state-loading"/);
  assert.match(appSurfaces, /className="app-state app-state-error"/);
  assert.match(appSurfaces, /className="app-state app-state-empty"/);
  assert.match(styles, /\.dialog-overlay\s*\{/);
  assert.match(styles, /\.dialog-shell\s*\{/);
  assert.match(styles, /\.app-state\s*\{/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test("phase 5 visual QA harness covers fixed-window visual states", () => {
  const visualQaHtml = readRepoFile("visual-qa.html");
  const visualQa = readRepoFile("src/visualQa.tsx");
  const visualQaStyles = readRepoFile("src/visualQa.css");

  assert.match(visualQaHtml, /src="\/src\/visualQa\.tsx"/);
  assert.match(visualQaStyles, /\.visual-qa-window\s*\{[\s\S]*width:\s*300px[\s\S]*height:\s*200px/);

  for (const scenario of [
    "normal-two-displays",
    "long-display-name",
    "long-display-name-notice",
    "hdr-off-disabled",
    "hdr-pending-disabled",
    "many-displays",
    "loading",
    "empty",
    "error",
    "settings-dialog",
    "about-dialog",
    "startup-info-dialog",
    "light-theme",
  ]) {
    assert.match(visualQa, new RegExp(`label="${scenario}"`));
  }

  assert.match(visualQa, /<SettingsDialog\s+[\s\S]*open/);
  assert.match(visualQa, /<AboutDialog\s+open/);
  assert.match(visualQa, /<StartupInfoDialog\s+open/);
  assert.match(visualQaStyles, /\.visual-qa-window\[data-theme="dark"\]/);
  assert.match(visualQaStyles, /\.visual-qa-window\[data-theme="light"\]/);
});

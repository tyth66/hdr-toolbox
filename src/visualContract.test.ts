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
  const bodyRule = extractCssRule(styles, "body");

  assert.doesNotMatch(styles, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.doesNotMatch(styles, /text-shadow\s*:/);
  assert.doesNotMatch(styles, /box-shadow:\s*0\s+0\s+\d+px\s+rgba\(0,\s*120,\s*212/i);
  assert.match(
    bodyRule,
    /font-family:\s*"Segoe UI Variable",\s*"Segoe UI",\s*"Microsoft YaHei UI",\s*"Microsoft YaHei",\s*system-ui,\s*sans-serif/
  );
  assert.match(bodyRule, /font-size:\s*14px/);
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
  const rootRule = extractCssRule(styles, "html, body, #root");
  const micaWindowRule = extractCssRule(styles, ".mica-window");
  const sideNavRule = extractCssRule(styles, ".side-nav");
  const dialogOverlayRule = extractCssRule(styles, ".dialog-overlay");
  assert.match(rootRule, /background:\s*transparent/);
  assert.doesNotMatch(rootRule, /background:\s*var\(--acrylic-window-tint\)/);
  assert.match(fluentRootRule, /background:\s*transparent/);
  assert.match(styles, /--acrylic-window-tint:\s*#181818/);
  assert.doesNotMatch(styles, /--acrylic-window-tint:\s*rgba\(24,\s*24,\s*24,\s*0\.3\)/);
  assert.match(styles, /\.app-theme-dark\s*\{[\s\S]*--color-text-primary:\s*#ffffff/);
  assert.match(styles, /\.app-theme-dark\s*\{[\s\S]*--color-surface:\s*rgba\(255,\s*255,\s*255,\s*0\.07\)/);
  assert.match(styles, /\.app-theme-dark\s*\{[\s\S]*--color-surface-hover:\s*rgba\(255,\s*255,\s*255,\s*0\.1\)/);
  assert.match(styles, /\.app-theme-dark\s*\{[\s\S]*--color-surface-active:\s*rgba\(255,\s*255,\s*255,\s*0\.14\)/);
  assert.match(styles, /\.app-theme-dark\s*\{[\s\S]*--side-nav-bg:\s*rgba\(255,\s*255,\s*255,\s*0\.07\)/);
  assert.match(styles, /\.app-theme-light\s*\{[\s\S]*--acrylic-window-tint:\s*#ffffff/);
  assert.doesNotMatch(styles, /\.app-theme-light\s*\{[\s\S]*--acrylic-window-tint:\s*rgba\(255,\s*255,\s*255,\s*0\.3\)/);
  assert.match(styles, /\.app-theme-light\s*\{[\s\S]*--color-text-primary:\s*#1a1c1f/);
  assert.match(styles, /\.app-theme-light\s*\{[\s\S]*--glass-highlight:\s*transparent/);
  assert.match(styles, /\.app-theme-light\s*\{[\s\S]*--color-surface:\s*rgba\(0,\s*0,\s*0,\s*0\.07\)/);
  assert.match(styles, /\.app-theme-light\s*\{[\s\S]*--color-surface-hover:\s*rgba\(0,\s*0,\s*0,\s*0\.1\)/);
  assert.match(styles, /\.app-theme-light\s*\{[\s\S]*--color-surface-active:\s*rgba\(0,\s*0,\s*0,\s*0\.14\)/);
  assert.match(styles, /\.app-theme-light\s*\{[\s\S]*--side-nav-bg:\s*rgba\(0,\s*0,\s*0,\s*0\.07\)/);
  assert.match(styles, /--dialog-overlay-bg:\s*rgba\(0,\s*0,\s*0,\s*0\.34\)/);
  assert.match(styles, /\.app-theme-light\s*\{[\s\S]*--dialog-overlay-bg:\s*rgba\(255,\s*255,\s*255,\s*0\.22\)/);
  assert.match(micaWindowRule, /background:\s*linear-gradient\(/);
  assert.match(micaWindowRule, /var\(--glass-highlight\)/);
  assert.match(micaWindowRule, /var\(--acrylic-window-tint\)/);
  assert.match(micaWindowRule, /backdrop-filter:\s*blur\(28px\)\s+saturate\(1\.45\)/);
  assert.doesNotMatch(micaWindowRule, /background:\s*var\(--color-window\)/);
  assert.match(dialogOverlayRule, /background:\s*var\(--dialog-overlay-bg\)/);
  assert.doesNotMatch(dialogOverlayRule, /background:\s*rgba\(0,\s*0,\s*0,\s*0\.34\)/);
  assert.match(styles, /--color-surface:\s*rgba\(255,\s*255,\s*255,\s*0\.07\)/);
  assert.match(sideNavRule, /background:\s*var\(--side-nav-bg\)/);
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

test("display navigation icon hover and selected state use fixed Codex accent", () => {
  const deviceNav = readRepoFile("src/components/DeviceNav.tsx");
  const styles = readRepoFile("src/styles.css");

  assert.match(deviceNav, /className=\{`side-nav-btn \$\{selectedIndex === idx \? "active" : ""\}`\}/);
  assert.match(styles, /\.fluent-root \.side-nav-btn:hover,\s*[\r\n]+\.fluent-root \.side-nav-btn\.active\s*\{[\s\S]*color:\s*var\(--win-blue\)\s*!important/);
  assert.match(styles, /\.fluent-root \.side-nav-btn:hover svg,[\s\S]*\.fluent-root \.side-nav-btn\.active svg \*\s*\{[\s\S]*stroke:\s*currentColor\s*!important/);
  assert.match(styles, /\.fluent-root \.side-nav-btn:focus-visible\s*\{[\s\S]*outline:\s*2px solid color-mix\(in srgb, var\(--win-blue\)/);
});

test("main brightness surface shows the selected display name", () => {
  const mainSurface = readRepoFile("src/components/MainSurface.tsx");
  const brightnessSlider = readRepoFile("src/components/BrightnessSlider.tsx");
  const styles = readRepoFile("src/styles.css");
  const contentRule = extractCssRule(styles, ".content");
  const sliderSectionRule = extractCssRule(styles, ".slider-section");
  const brightnessSliderRule = extractCssRule(styles, ".brightness-slider-control");

  assert.match(brightnessSlider, /displayName:\s*string/);
  assert.match(brightnessSlider, /className="display-name"/);
  assert.match(brightnessSlider, /title=\{displayName\}/);
  assert.match(brightnessSlider, /className="brightness-slider-control"/);
  assert.match(mainSurface, /displayName=\{selectedDisplay\?\.name \?\? "Unknown display"\}/);
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

test("Fluent switches use fixed Codex accent and compact HDR thumb stays inside track", () => {
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

test("settings dialog keeps settings accessible without section headings", () => {
  const settingsDialog = readRepoFile("src/components/SettingsDialog.tsx");
  const styles = readRepoFile("src/styles.css");

  for (const label of ["Auto-start", "Theme", "Sync all displays", "Brightness +", "Brightness -", "HDR Toolbox"]) {
    assert.ok(settingsDialog.includes(`<span>${label}</span>`));
  }

  assert.doesNotMatch(settingsDialog, /className="settings-heading"/);
  assert.match(settingsDialog, /role="radiogroup"/);
  assert.match(settingsDialog, /aria-label="Theme"/);
  assert.match(settingsDialog, /aria-checked=\{themePreference === option\.value\}/);
  assert.match(settingsDialog, /aria-label="Toggle auto-start"/);
  assert.match(settingsDialog, /aria-label="Toggle synced brightness"/);
  assert.doesNotMatch(settingsDialog, /v1\.0\.0/);
  assert.match(styles, /\.settings-group\s*\{/);
  assert.doesNotMatch(styles, /\.settings-heading\s*\{/);
  assert.match(styles, /\.settings-footer\s*\{/);
  assert.match(styles, /\.theme-segmented\s*\{/);
  assert.match(styles, /\.shortcut-btn\s*\{[\s\S]*width:\s*100px/);
});

test("theme preference can override system color scheme", () => {
  const app = readRepoFile("src/App.tsx");
  const useSettingsController = readRepoFile("src/app/useSettingsController.ts");
  const useAccentColor = readRepoFile("src/hooks/useAccentColor.ts");
  const tauriApi = readRepoFile("src/services/tauriApi.ts");
  const displayMod = readRepoFile("src-tauri/src/display/mod.rs");
  const tauriLib = readRepoFile("src-tauri/src/lib.rs");
  const settingsDialog = readRepoFile("src/components/SettingsDialog.tsx");
  const styles = readRepoFile("src/styles.css");
  const theme = readRepoFile("src/theme.ts");

  assert.match(useSettingsController, /loadThemePreference/);
  assert.match(useSettingsController, /saveThemePreference/);
  assert.match(useAccentColor, /refreshAccentColor/);
  assert.match(useAccentColor, /FIXED_CODEX_ACCENT_COLOR\s*=\s*"#339CFF"/);
  assert.doesNotMatch(useAccentColor, /getSystemAccentColor/);
  assert.doesNotMatch(useAccentColor, /from "\.\.\/services\/tauriApi"/);
  assert.doesNotMatch(tauriApi, /getSystemAccentColor/);
  assert.doesNotMatch(displayMod, /accent|get_system_accent_color/);
  assert.doesNotMatch(tauriLib, /get_system_accent_color/);
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
  assert.match(styles, /--color-accent:\s*#339CFF/);
  assert.match(styles, /--color-accent-hover:\s*#339CFF/);
  assert.match(styles, /--color-accent-active:\s*#339CFF/);
  assert.doesNotMatch(styles, /--color-accent:\s*#0078d4/i);
  assert.match(styles, /\.app-theme-light\s*\{/);
  assert.match(styles, /\.app-theme-dark\s*\{/);
  assert.match(theme, /FALLBACK_ACCENT\s*=\s*"#339CFF"/);
  assert.match(theme, /colorBrandBackground/);
  assert.match(theme, /colorCompoundBrandStrokePressed/);
  assert.doesNotMatch(theme, /webDarkTheme|webLightTheme/);
});

test("settings and notice actions use Fluent UI Button instead of raw buttons", () => {
  const app = readRepoFile("src/App.tsx");
  const mainSurface = readRepoFile("src/components/MainSurface.tsx");
  const settingsDialog = readRepoFile("src/components/SettingsDialog.tsx");
  const visualQa = readRepoFile("src/visualQa.tsx");

  assert.match(app, /import \{[\s\S]*FluentProvider,[\s\S]*webDarkTheme,/);
  assert.match(mainSurface, /import \{[\s\S]*Button[\s\S]*\} from "@fluentui\/react-components"/);
  assert.match(mainSurface, /<Button[\s\S]*className="notice-dismiss"/);
  assert.doesNotMatch(mainSurface, /<button[\s\S]*className="notice-dismiss"/);

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
  const appStateSurfaces = readRepoFile("src/components/AppStateSurfaces.tsx");
  const styles = readRepoFile("src/styles.css");

  for (const dialog of [aboutDialog, settingsDialog, startupDialog]) {
    assert.match(dialog, /className="dialog-overlay"/);
    assert.match(dialog, /className="dialog-shell"/);
  }

  assert.doesNotMatch(startupDialog, /style=\{\{/);
  assert.match(appStateSurfaces, /className="app-state app-state-loading"/);
  assert.match(appStateSurfaces, /className="app-state app-state-error"/);
  assert.match(appStateSurfaces, /className="app-state app-state-empty"/);
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
  assert.match(visualQaStyles, /\.visual-qa-window\[data-theme="dark"\]\s*\{[\s\S]*--acrylic-window-tint:\s*#181818/);
  assert.doesNotMatch(visualQaStyles, /\.visual-qa-window\[data-theme="dark"\]\s*\{[\s\S]*--acrylic-window-tint:\s*rgba\(24,\s*24,\s*24,\s*0\.3\)/);
  assert.match(visualQaStyles, /\.visual-qa-window\[data-theme="dark"\]\s*\{[\s\S]*--color-text-primary:\s*#ffffff/);
  assert.match(visualQaStyles, /\.visual-qa-window\[data-theme="dark"\]\s*\{[\s\S]*--color-surface:\s*rgba\(255,\s*255,\s*255,\s*0\.07\)/);
  assert.match(visualQaStyles, /\.visual-qa-window\[data-theme="dark"\]\s*\{[\s\S]*--side-nav-bg:\s*rgba\(255,\s*255,\s*255,\s*0\.07\)/);
  assert.match(visualQaStyles, /\.visual-qa-window\[data-theme="light"\]\s*\{[\s\S]*--acrylic-window-tint:\s*#ffffff/);
  assert.doesNotMatch(visualQaStyles, /\.visual-qa-window\[data-theme="light"\]\s*\{[\s\S]*--acrylic-window-tint:\s*rgba\(255,\s*255,\s*255,\s*0\.3\)/);
  assert.match(visualQaStyles, /\.visual-qa-window\[data-theme="light"\]\s*\{[\s\S]*--color-text-primary:\s*#1a1c1f/);
  assert.match(visualQaStyles, /\.visual-qa-window\[data-theme="light"\]\s*\{[\s\S]*--color-surface:\s*rgba\(0,\s*0,\s*0,\s*0\.07\)/);
  assert.match(visualQaStyles, /\.visual-qa-window\[data-theme="light"\]\s*\{[\s\S]*--side-nav-bg:\s*rgba\(0,\s*0,\s*0,\s*0\.07\)/);
  assert.match(visualQaStyles, /\.visual-qa-window\[data-theme="light"\]\s*\{[\s\S]*--glass-highlight:\s*transparent/);
});

test("visual QA covers all brightness source display states", () => {
  const visualQa = readRepoFile("src/visualQa.tsx");

  for (const scenario of [
    "ddc-high-level-display",
    "ddc-vcp-display",
    "wmi-internal-display",
    "hdr-sdr-display",
  ]) {
    assert.match(visualQa, new RegExp(`label="${scenario}"`));
  }
});

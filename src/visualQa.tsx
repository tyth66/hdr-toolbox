import React from "react";
import ReactDOM from "react-dom/client";
import { Button, FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import "./styles.css";
import "./visualQa.css";
import { AboutDialog } from "./components/AboutDialog";
import { BrightnessSlider } from "./components/BrightnessSlider";
import { DeviceNav } from "./components/DeviceNav";
import { SettingsDialog } from "./components/SettingsDialog";
import { StartupInfoDialog } from "./components/StartupInfoDialog";
import { StatusBar } from "./components/StatusBar";
import { SvgIcon } from "./components/SvgIcon";
import { TitleBar } from "./components/TitleBar";
import { createSystemAccentTheme } from "./theme";
import { HOTKEYS, type DisplayInfo } from "./types";

const VISUAL_QA_ACCENT = "#c38aa0";
const VISUAL_QA_ACCENT_STYLE = {
  "--color-accent": VISUAL_QA_ACCENT,
  "--color-accent-hover": "#d49daf",
  "--color-accent-active": "#aa7186",
  "--win-blue": VISUAL_QA_ACCENT,
  "--win-blue-dim": "#aa7186",
  "--accent": VISUAL_QA_ACCENT,
  "--accent-dim": "#aa7186",
} as React.CSSProperties;

const displays: DisplayInfo[] = [
  {
    name: "LG UltraGear HDR Primary Display With Extra Long Friendly Name That Must Truncate Cleanly",
    nits: 312,
    min_percentage: 0,
    max_percentage: 100,
    hdr_supported: true,
    hdr_enabled: true,
    adapter_id_low: 1,
    adapter_id_high: 0,
    target_id: 1,
  },
  {
    name: "Studio HDR",
    nits: 220,
    min_percentage: 0,
    max_percentage: 100,
    hdr_supported: true,
    hdr_enabled: false,
    adapter_id_low: 2,
    adapter_id_high: 0,
    target_id: 2,
  },
  {
    name: "Reference HDR",
    nits: 180,
    min_percentage: 0,
    max_percentage: 100,
    hdr_supported: true,
    hdr_enabled: true,
    adapter_id_low: 3,
    adapter_id_high: 0,
    target_id: 3,
  },
  {
    name: "Side HDR",
    nits: 280,
    min_percentage: 0,
    max_percentage: 100,
    hdr_supported: true,
    hdr_enabled: true,
    adapter_id_low: 4,
    adapter_id_high: 0,
    target_id: 4,
  },
];

const noop = () => {};
const noopAsync = async () => {};

type WindowFrameProps = {
  children: React.ReactNode;
  label: string;
  theme?: "dark" | "light";
};

function WindowFrame({ children, label, theme = "dark" }: WindowFrameProps) {
  const fluentTheme = createSystemAccentTheme(
    theme === "light" ? webLightTheme : webDarkTheme,
    VISUAL_QA_ACCENT
  );

  return (
    <section className="visual-qa-case" aria-label={label} data-scenario={label}>
      <h2>{label}</h2>
      <FluentProvider className="fluent-root" theme={fluentTheme} style={VISUAL_QA_ACCENT_STYLE}>
        <div className={`mica-window visual-qa-window app-theme-${theme}`} data-theme={theme}>
          {children}
        </div>
      </FluentProvider>
    </section>
  );
}

type MainSurfaceProps = {
  displaySet?: DisplayInfo[];
  selectedIndex?: number;
  value?: number;
  hdrActive?: boolean;
  hdrPending?: boolean;
  notice?: boolean;
  refreshing?: boolean;
};

function MainSurface({
  displaySet = displays.slice(0, 2),
  selectedIndex = 0,
  value = 58,
  hdrActive = true,
  hdrPending = false,
  notice = false,
  refreshing = false,
}: MainSurfaceProps) {
  const selectedDisplay = displaySet[selectedIndex] ?? displaySet[0];

  return (
    <>
      <TitleBar
        refreshing={refreshing}
        onRefresh={noopAsync}
        onOpenSettings={noop}
        onClose={noop}
      />
      {notice ? (
        <div className="notice-banner" role="status" aria-live="polite">
          <div className="notice-copy">
            <strong>Partial update</strong>
            <span>One display could not apply the synced brightness change.</span>
          </div>
          <Button
            className="notice-dismiss"
            appearance="subtle"
            size="small"
            icon={<SvgIcon name="close" />}
            title="Dismiss"
            aria-label="Dismiss"
          />
        </div>
      ) : null}
      <div className="main-layout">
        <DeviceNav displays={displaySet} selectedIndex={selectedIndex} onSelect={noop} />
        <section className="content">
          <BrightnessSlider
            value={value}
            displayName={selectedDisplay.name}
            disabled={!hdrActive || hdrPending}
            onChange={noop}
            onPointerDown={noop}
            onCommit={noopAsync}
            onWheelAdjust={noop}
          />
          <StatusBar
            hdrSupported={selectedDisplay.hdr_supported}
            hdrActive={hdrActive}
            hdrPending={hdrPending}
            onToggleHdr={noopAsync}
          />
        </section>
      </div>
    </>
  );
}

function StateSurface({ type }: { type: "loading" | "empty" | "error" }) {
  return (
    <>
      <TitleBar minimal onClose={noop} />
      <div className={`app-state app-state-${type}`}>
        {type === "loading" ? <span>Looking for HDR-capable displays...</span> : null}
        {type === "empty" ? (
          <div className="state-message">
            No HDR-capable displays found.
            <br />
            Check your display connection or Windows display settings.
          </div>
        ) : null}
        {type === "error" ? (
          <div className="state-message">Windows display configuration is temporarily unavailable.</div>
        ) : null}
      </div>
    </>
  );
}

function VisualQaApp() {
  return (
    <main className="visual-qa-page">
      <header className="visual-qa-header">
        <h1>HDR Toolbox Phase 5 Visual QA</h1>
        <p>Static harness using production components, fixed 300 x 200 windows, and production CSS.</p>
      </header>
      <div className="visual-qa-grid">
        <WindowFrame label="normal-two-displays">
          <MainSurface />
        </WindowFrame>
        <WindowFrame label="long-display-name">
          <MainSurface />
        </WindowFrame>
        <WindowFrame label="long-display-name-notice">
          <MainSurface notice />
        </WindowFrame>
        <WindowFrame label="hdr-off-disabled">
          <MainSurface selectedIndex={1} hdrActive={false} value={35} />
        </WindowFrame>
        <WindowFrame label="hdr-pending-disabled">
          <MainSurface hdrPending refreshing value={76} />
        </WindowFrame>
        <WindowFrame label="many-displays">
          <MainSurface displaySet={displays} selectedIndex={2} value={44} />
        </WindowFrame>
        <WindowFrame label="loading">
          <StateSurface type="loading" />
        </WindowFrame>
        <WindowFrame label="empty">
          <StateSurface type="empty" />
        </WindowFrame>
        <WindowFrame label="error">
          <StateSurface type="error" />
        </WindowFrame>
        <WindowFrame label="settings-dialog">
          <MainSurface />
          <SettingsDialog
            open
            autostartEnabled
            syncBrightnessEnabled
            themePreference="system"
            hotkeys={HOTKEYS}
            hotkeyRecordingDirection={null}
            hotkeyError={null}
            hotkeyErrorSeq={0}
            onClose={noop}
            onToggleAutostart={noopAsync}
            onToggleSyncBrightness={noop}
            onChangeThemePreference={noop}
            onStartHotkeyRecording={noop}
            onShowAbout={noop}
          />
        </WindowFrame>
        <WindowFrame label="about-dialog">
          <MainSurface />
          <AboutDialog open hotkeys={HOTKEYS} onClose={noop} />
        </WindowFrame>
        <WindowFrame label="startup-info-dialog">
          <MainSurface displaySet={displays} />
          <StartupInfoDialog open displays={displays} onClose={noop} />
        </WindowFrame>
        <WindowFrame label="light-theme" theme="light">
          <MainSurface notice />
        </WindowFrame>
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <VisualQaApp />
  </React.StrictMode>,
);

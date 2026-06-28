import "./styles.css";
import { useCallback, useMemo } from "react";
import {
  Button,
  FluentProvider,
  webDarkTheme,
  webLightTheme,
} from "@fluentui/react-components";
import { useAppController } from "./app/useAppController";
import { useNoticeController } from "./app/useNoticeController";
import { useBrightnessController } from "./brightness/useBrightnessController";
import { AboutDialog } from "./components/AboutDialog";
import { BrightnessSlider } from "./components/BrightnessSlider";
import { DeviceNav } from "./components/DeviceNav";
import { SettingsDialog } from "./components/SettingsDialog";
import { StartupInfoDialog } from "./components/StartupInfoDialog";
import { StatusBar } from "./components/StatusBar";
import { SvgIcon } from "./components/SvgIcon";
import { TitleBar } from "./components/TitleBar";
import { useAccentColor } from "./hooks/useAccentColor";
import { useDisplays } from "./hooks/useDisplays";
import { useStartupOverlay } from "./hooks/useStartupOverlay";
import { useSystemColorScheme } from "./hooks/useSystemColorScheme";
import { useWindowPosition } from "./hooks/useWindowPosition";
import {
  createSystemAccentTheme,
  resolveEffectiveThemePreference,
} from "./theme";

export type { DisplayInfo } from "./types";

function App() {
  const { accentColor, refreshAccentColor } = useAccentColor();
  const systemPrefersDark = useSystemColorScheme();

  const { showWindow, hideWindow, handleTitleBarMouseDown } = useWindowPosition();
  const showWindowWithAccentRefresh = useCallback(async () => {
    await refreshAccentColor();
    await showWindow();
  }, [refreshAccentColor, showWindow]);
  const { showStartupInfo, startStartupOverlay, closeStartupOverlay } =
    useStartupOverlay();
  const {
    displays,
    selectedIndex,
    selectDisplay,
    currentPercentage,
    currentPercentageRef,
    hdrActive,
    isHdrPending,
    loading,
    isRefreshing,
    error,
    notice,
    setNotice,
    loadDisplays,
    refreshDisplays,
    toggleHdr,
    previewPercentage,
    applyBrightness,
  } = useDisplays({
    showWindow: showWindowWithAccentRefresh,
    startStartupOverlay,
  });

  const {
    showSettings,
    setShowSettings,
    showAbout,
    setShowAbout,
    autostartEnabled,
    syncBrightnessEnabled,
    themePreference,
    hotkeys,
    handleToggleAutostart,
    handleToggleSyncBrightness,
    handleThemePreferenceChange,
    handleHotkeyChange,
    handleHotkeyReset,
  } = useAppController({
    loadDisplays,
    refreshDisplays,
    selectDisplay,
    showWindow: showWindowWithAccentRefresh,
    currentPercentageRef,
    applyBrightness,
    setNotice,
  });

  const {
    handleSliderChange,
    handleSliderDown,
    handleSliderCommit,
    handleSliderWheel,
  } = useBrightnessController({
    hdrActive,
    isHdrPending,
    currentPercentageRef,
    previewPercentage,
    applyBrightness,
  });

  useNoticeController({ notice, setNotice });
  const effectiveThemePreference = resolveEffectiveThemePreference(
    themePreference,
    systemPrefersDark
  );
  const windowClassName = `mica-window app-theme-${effectiveThemePreference}`;
  const baseFluentTheme =
    effectiveThemePreference === "light" ? webLightTheme : webDarkTheme;
  const fluentTheme = useMemo(
    () => createSystemAccentTheme(baseFluentTheme, accentColor),
    [accentColor, baseFluentTheme]
  );

  const renderContent = () => {
    if (loading) {
      return (
        <div className={windowClassName}>
          <TitleBar minimal onClose={hideWindow} />
          <div className="app-state app-state-loading">
            <span>Looking for HDR-capable displays...</span>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className={windowClassName}>
          <TitleBar minimal onClose={hideWindow} />
          <div className="app-state app-state-error">
            <div className="state-message">{error}</div>
          </div>
        </div>
      );
    }

    if (displays.length === 0) {
      return (
        <div className={windowClassName}>
          <TitleBar minimal onClose={hideWindow} />
          <div className="app-state app-state-empty">
            <div className="state-message">
              No HDR-capable displays found.
              <br />
              Check your display connection or Windows display settings.
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={windowClassName}>
        <TitleBar
          onMouseDown={handleTitleBarMouseDown}
          refreshing={isRefreshing}
          onRefresh={() => refreshDisplays()}
          onOpenSettings={() => setShowSettings(true)}
          onClose={hideWindow}
        />

        {notice ? (
          <div className="notice-banner" role="status" aria-live="polite">
            <div className="notice-copy">
              <strong>{notice.title}</strong>
              <span>{notice.message}</span>
            </div>
            <Button
              className="notice-dismiss"
              appearance="subtle"
              size="small"
              icon={<SvgIcon name="close" />}
              onClick={() => setNotice(null)}
              title="Dismiss"
              aria-label="Dismiss"
            />
          </div>
        ) : null}

        <div className="main-layout">
          <DeviceNav
            displays={displays}
            selectedIndex={selectedIndex}
            onSelect={selectDisplay}
          />

          <section className="content">
            <BrightnessSlider
              value={currentPercentage}
              displayName={displays[selectedIndex]?.name ?? "Unknown display"}
              disabled={!hdrActive || isHdrPending}
              onChange={handleSliderChange}
              onPointerDown={handleSliderDown}
              onCommit={handleSliderCommit}
              onWheelAdjust={handleSliderWheel}
            />
            <StatusBar
              hdrSupported={displays[selectedIndex]?.hdr_supported ?? false}
              hdrActive={hdrActive}
              hdrPending={isHdrPending}
              onToggleHdr={toggleHdr}
            />
          </section>
        </div>

        <SettingsDialog
          open={showSettings}
          autostartEnabled={autostartEnabled}
          syncBrightnessEnabled={syncBrightnessEnabled}
          themePreference={themePreference}
          hotkeys={hotkeys}
          onClose={() => setShowSettings(false)}
          onToggleAutostart={handleToggleAutostart}
          onToggleSyncBrightness={handleToggleSyncBrightness}
          onChangeThemePreference={handleThemePreferenceChange}
          onUpdateHotkey={handleHotkeyChange}
          onResetHotkeys={handleHotkeyReset}
          onShowAbout={() => setShowAbout(true)}
        />

        <AboutDialog
          open={showAbout}
          hotkeys={hotkeys}
          onClose={() => setShowAbout(false)}
        />

        <StartupInfoDialog
          open={showStartupInfo}
          displays={displays}
          onClose={closeStartupOverlay}
        />
      </div>
    );
  };

  return (
    <FluentProvider className="fluent-root" theme={fluentTheme}>
      {renderContent()}
    </FluentProvider>
  );
}

export default App;

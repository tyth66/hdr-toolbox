import "./styles.css";
import { useCallback, useMemo } from "react";
import {
  FluentProvider,
  webDarkTheme,
  webLightTheme,
} from "@fluentui/react-components";
import { useAppController } from "./app/useAppController";
import { useNoticeController } from "./app/useNoticeController";
import { useBrightnessController } from "./brightness/useBrightnessController";
import {
  EmptySurface,
  ErrorSurface,
  LoadingSurface,
  MainSurface,
} from "./components/AppSurfaces";
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
    hotkeyRecordingDirection,
    handleStartHotkeyRecording,
    hotkeyError,
    hotkeyErrorSeq,
    handleToggleAutostart,
    handleToggleSyncBrightness,
    handleThemePreferenceChange,
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
        <LoadingSurface
          windowClassName={windowClassName}
          onClose={hideWindow}
        />
      );
    }

    if (error) {
      return (
        <ErrorSurface
          windowClassName={windowClassName}
          onClose={hideWindow}
          error={error}
        />
      );
    }

    if (displays.length === 0) {
      return (
        <EmptySurface
          windowClassName={windowClassName}
          onClose={hideWindow}
        />
      );
    }

    return (
      <MainSurface
        windowClassName={windowClassName}
        displays={displays}
        selectedIndex={selectedIndex}
        currentPercentage={currentPercentage}
        hdrActive={hdrActive}
        isHdrPending={isHdrPending}
        isRefreshing={isRefreshing}
        notice={notice}
        showSettings={showSettings}
        showAbout={showAbout}
        autostartEnabled={autostartEnabled}
        syncBrightnessEnabled={syncBrightnessEnabled}
        themePreference={themePreference}
        hotkeys={hotkeys}
        hotkeyRecordingDirection={hotkeyRecordingDirection}
        showStartupInfo={showStartupInfo}
        onTitleBarMouseDown={handleTitleBarMouseDown}
        onRefreshDisplays={refreshDisplays}
        onSelectDisplay={selectDisplay}
        onSetNotice={setNotice}
        onSetShowSettings={setShowSettings}
        onSetShowAbout={setShowAbout}
        onToggleHdr={toggleHdr}
        onSliderChange={handleSliderChange}
        onSliderDown={handleSliderDown}
        onSliderCommit={handleSliderCommit}
        onSliderWheel={handleSliderWheel}
        onToggleAutostart={handleToggleAutostart}
        onToggleSyncBrightness={handleToggleSyncBrightness}
        onChangeThemePreference={handleThemePreferenceChange}
        onStartHotkeyRecording={handleStartHotkeyRecording}
        hotkeyError={hotkeyError}
        hotkeyErrorSeq={hotkeyErrorSeq}
        onClose={hideWindow}
        onCloseStartupOverlay={closeStartupOverlay}
      />
    );
  };

  return (
    <FluentProvider className="fluent-root" theme={fluentTheme}>
      {renderContent()}
    </FluentProvider>
  );
}

export default App;

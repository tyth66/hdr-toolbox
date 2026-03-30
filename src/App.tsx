import "./styles.css";
import { useAppController } from "./app/useAppController";
import { useNoticeController } from "./app/useNoticeController";
import { useBrightnessController } from "./brightness/useBrightnessController";
import { AboutDialog } from "./components/AboutDialog";
import { BrightnessSlider } from "./components/BrightnessSlider";
import { DeviceNav } from "./components/DeviceNav";
import { SettingsDialog } from "./components/SettingsDialog";
import { StartupInfoDialog } from "./components/StartupInfoDialog";
import { StatusBar } from "./components/StatusBar";
import { TitleBar } from "./components/TitleBar";
import { useDisplays } from "./hooks/useDisplays";
import { useStartupOverlay } from "./hooks/useStartupOverlay";
import { useWindowPosition } from "./hooks/useWindowPosition";

export type { DisplayInfo } from "./types";

function App() {
  const { showWindow, hideWindow, handleTitleBarMouseDown } = useWindowPosition();
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
    showWindow,
    startStartupOverlay,
  });

  const {
    showSettings,
    setShowSettings,
    showAbout,
    setShowAbout,
    autostartEnabled,
    hotkeys,
    handleToggleAutostart,
    handleHotkeyChange,
    handleHotkeyReset,
    handleQuit,
  } = useAppController({
    loadDisplays,
    refreshDisplays,
    selectDisplay,
    showWindow,
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

  if (loading) {
    return (
      <div className="mica-window">
        <TitleBar minimal onClose={hideWindow} />
        <div className="app-loading">
          <span>Looking for HDR-capable displays...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mica-window">
        <TitleBar minimal onClose={hideWindow} />
        <div className="app-container">
          <div className="error-message">{error}</div>
        </div>
      </div>
    );
  }

  if (displays.length === 0) {
    return (
      <div className="mica-window">
        <TitleBar minimal onClose={hideWindow} />
        <div className="app-container">
          <div className="error-message">
            No HDR-capable displays found.
            <br />
            Check your display connection or Windows display settings.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mica-window">
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
          <button
            className="notice-dismiss"
            type="button"
            onClick={() => setNotice(null)}
            title="Dismiss"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
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
        hotkeys={hotkeys}
        onClose={() => setShowSettings(false)}
        onToggleAutostart={handleToggleAutostart}
        onUpdateHotkey={handleHotkeyChange}
        onResetHotkeys={handleHotkeyReset}
        onShowAbout={() => setShowAbout(true)}
        onQuit={handleQuit}
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
}

export default App;

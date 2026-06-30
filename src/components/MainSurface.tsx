import { memo, type MouseEventHandler, type WheelEventHandler } from "react";
import { Button } from "@fluentui/react-components";
import { isBrightnessAdjustable } from "../brightness/brightnessCapability";
import { getBrightnessSourceLabel } from "../brightnessSource";
import type { AppNotice } from "../errors";
import type { DisplayInfo, HotkeyConfig, ThemePreference } from "../types";
import { AboutDialog } from "./AboutDialog";
import { BrightnessSlider } from "./BrightnessSlider";
import { DeviceNav } from "./DeviceNav";
import { SettingsDialog } from "./SettingsDialog";
import { StartupInfoDialog } from "./StartupInfoDialog";
import { StatusBar } from "./StatusBar";
import { SvgIcon } from "./SvgIcon";
import { TitleBar } from "./TitleBar";

type AppShellSurfaceProps = {
  windowClassName: string;
  onClose: () => void;
};

export type MainSurfaceDisplayProps = {
  displays: DisplayInfo[];
  selectedIndex: number;
  currentPercentage: number;
  hdrActive: boolean;
  isHdrPending: boolean;
  isRefreshing: boolean;
  notice: AppNotice | null;
  showStartupInfo: boolean;
};

export type MainSurfaceSettingsProps = {
  showSettings: boolean;
  showAbout: boolean;
  autostartEnabled: boolean;
  syncBrightnessEnabled: boolean;
  themePreference: ThemePreference;
  hotkeys: HotkeyConfig;
  hotkeyRecordingDirection: "increase" | "decrease" | null;
  hotkeyError: string | null;
  hotkeyErrorSeq: number;
};

export type MainSurfaceBrightnessProps = {
  onSliderChange: (value: number, element: HTMLInputElement) => void;
  onSliderDown: () => void;
  onSliderCommit: (value: number) => Promise<void>;
  onSliderWheel: WheelEventHandler<HTMLDivElement>;
};

export type MainSurfaceActions = {
  onTitleBarMouseDown: MouseEventHandler<HTMLElement>;
  onRefreshDisplays: () => Promise<void>;
  onSelectDisplay: (index: number) => void;
  onSetNotice: (notice: AppNotice | null) => void;
  onSetShowSettings: (open: boolean) => void;
  onSetShowAbout: (open: boolean) => void;
  onToggleHdr: () => Promise<void>;
  onToggleAutostart: () => Promise<void>;
  onToggleSyncBrightness: () => void;
  onChangeThemePreference: (preference: ThemePreference) => void;
  onStartHotkeyRecording: (direction: "increase" | "decrease") => void;
  onCloseStartupOverlay: () => void;
};

type MainSurfaceProps = AppShellSurfaceProps & {
  display: MainSurfaceDisplayProps;
  settings: MainSurfaceSettingsProps;
  brightness: MainSurfaceBrightnessProps;
  actions: MainSurfaceActions;
};

export const MainSurface = memo(function MainSurface({
  windowClassName,
  onClose,
  display,
  settings,
  brightness,
  actions,
}: MainSurfaceProps) {
  const selectedDisplay = display.displays[display.selectedIndex];
  const selectedBrightnessSource = selectedDisplay?.brightness_source ?? "hdr_sdr";
  const brightnessSourceLabel = getBrightnessSourceLabel(selectedBrightnessSource);
  const sliderDisabled = !isBrightnessAdjustable(
    selectedBrightnessSource,
    display.hdrActive,
    display.isHdrPending
  );

  return (
    <div className={windowClassName}>
      <TitleBar
        onMouseDown={actions.onTitleBarMouseDown}
        refreshing={display.isRefreshing}
        onRefresh={actions.onRefreshDisplays}
        onOpenSettings={() => actions.onSetShowSettings(true)}
        onClose={onClose}
      />

      {display.notice ? (
        <div className="notice-banner" role="status" aria-live="polite">
          <div className="notice-copy">
            <strong>{display.notice.title}</strong>
            <span>{display.notice.message}</span>
          </div>
          <Button
            className="notice-dismiss"
            appearance="subtle"
            size="small"
            icon={<SvgIcon name="close" />}
            onClick={() => actions.onSetNotice(null)}
            title="Dismiss"
            aria-label="Dismiss"
          />
        </div>
      ) : null}

      <div className="main-layout">
        <DeviceNav
          displays={display.displays}
          selectedIndex={display.selectedIndex}
          onSelect={actions.onSelectDisplay}
        />

        <section className="content">
          <BrightnessSlider
            value={display.currentPercentage}
            displayName={selectedDisplay?.name ?? "Unknown display"}
            sourceLabel={brightnessSourceLabel}
            disabled={sliderDisabled}
            onChange={brightness.onSliderChange}
            onPointerDown={brightness.onSliderDown}
            onCommit={brightness.onSliderCommit}
            onWheelAdjust={brightness.onSliderWheel}
          />
          <StatusBar
            hdrSupported={selectedDisplay?.hdr_supported ?? false}
            hdrActive={display.hdrActive}
            brightnessSourceLabel={brightnessSourceLabel}
            hdrPending={display.isHdrPending}
            onToggleHdr={actions.onToggleHdr}
          />
        </section>
      </div>

      <SettingsDialog
        open={settings.showSettings}
        autostartEnabled={settings.autostartEnabled}
        syncBrightnessEnabled={settings.syncBrightnessEnabled}
        themePreference={settings.themePreference}
        hotkeys={settings.hotkeys}
        hotkeyRecordingDirection={settings.hotkeyRecordingDirection}
        onClose={() => actions.onSetShowSettings(false)}
        onToggleAutostart={actions.onToggleAutostart}
        onToggleSyncBrightness={actions.onToggleSyncBrightness}
        onChangeThemePreference={actions.onChangeThemePreference}
        onStartHotkeyRecording={actions.onStartHotkeyRecording}
        hotkeyError={settings.hotkeyError}
        hotkeyErrorSeq={settings.hotkeyErrorSeq}
        onShowAbout={() => actions.onSetShowAbout(true)}
      />

      <AboutDialog
        open={settings.showAbout}
        hotkeys={settings.hotkeys}
        onClose={() => actions.onSetShowAbout(false)}
      />

      <StartupInfoDialog
        open={display.showStartupInfo}
        displays={display.displays}
        onClose={actions.onCloseStartupOverlay}
      />
    </div>
  );
});

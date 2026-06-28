import { memo, type MouseEventHandler, type WheelEventHandler } from "react";
import { Button } from "@fluentui/react-components";
import type { AppNotice } from "../errors";
import type {
  DisplayInfo,
  HotkeyConfig,
  HotkeyDirection,
  ThemePreference,
} from "../types";
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

export const LoadingSurface = memo(function LoadingSurface({
  windowClassName,
  onClose,
}: AppShellSurfaceProps) {
  return (
    <div className={windowClassName}>
      <TitleBar minimal onClose={onClose} />
      <div className="app-state app-state-loading">
        <span>Looking for HDR-capable displays...</span>
      </div>
    </div>
  );
});

type ErrorSurfaceProps = AppShellSurfaceProps & {
  error: string;
};

export const ErrorSurface = memo(function ErrorSurface({
  windowClassName,
  onClose,
  error,
}: ErrorSurfaceProps) {
  return (
    <div className={windowClassName}>
      <TitleBar minimal onClose={onClose} />
      <div className="app-state app-state-error">
        <div className="state-message">{error}</div>
      </div>
    </div>
  );
});

export const EmptySurface = memo(function EmptySurface({
  windowClassName,
  onClose,
}: AppShellSurfaceProps) {
  return (
    <div className={windowClassName}>
      <TitleBar minimal onClose={onClose} />
      <div className="app-state app-state-empty">
        <div className="state-message">
          No HDR-capable displays found.
          <br />
          Check your display connection or Windows display settings.
        </div>
      </div>
    </div>
  );
});

type MainSurfaceProps = AppShellSurfaceProps & {
  displays: DisplayInfo[];
  selectedIndex: number;
  currentPercentage: number;
  hdrActive: boolean;
  isHdrPending: boolean;
  isRefreshing: boolean;
  notice: AppNotice | null;
  showSettings: boolean;
  showAbout: boolean;
  autostartEnabled: boolean;
  syncBrightnessEnabled: boolean;
  themePreference: ThemePreference;
  hotkeys: HotkeyConfig;
  showStartupInfo: boolean;
  onTitleBarMouseDown: MouseEventHandler<HTMLElement>;
  onRefreshDisplays: () => Promise<void>;
  onSelectDisplay: (index: number) => void;
  onSetNotice: (notice: AppNotice | null) => void;
  onSetShowSettings: (open: boolean) => void;
  onSetShowAbout: (open: boolean) => void;
  onToggleHdr: () => Promise<void>;
  onSliderChange: (value: number, element: HTMLInputElement) => void;
  onSliderDown: () => void;
  onSliderCommit: (value: number) => Promise<void>;
  onSliderWheel: WheelEventHandler<HTMLDivElement>;
  onToggleAutostart: () => Promise<void>;
  onToggleSyncBrightness: () => void;
  onChangeThemePreference: (preference: ThemePreference) => void;
  onUpdateHotkey: (direction: HotkeyDirection, value: string) => boolean;
  onResetHotkeys: () => void;
  onCloseStartupOverlay: () => void;
};

export const MainSurface = memo(function MainSurface({
  windowClassName,
  displays,
  selectedIndex,
  currentPercentage,
  hdrActive,
  isHdrPending,
  isRefreshing,
  notice,
  showSettings,
  showAbout,
  autostartEnabled,
  syncBrightnessEnabled,
  themePreference,
  hotkeys,
  showStartupInfo,
  onTitleBarMouseDown,
  onRefreshDisplays,
  onSelectDisplay,
  onSetNotice,
  onSetShowSettings,
  onSetShowAbout,
  onToggleHdr,
  onSliderChange,
  onSliderDown,
  onSliderCommit,
  onSliderWheel,
  onToggleAutostart,
  onToggleSyncBrightness,
  onChangeThemePreference,
  onUpdateHotkey,
  onResetHotkeys,
  onClose,
  onCloseStartupOverlay,
}: MainSurfaceProps) {
  const selectedDisplay = displays[selectedIndex];

  return (
    <div className={windowClassName}>
      <TitleBar
        onMouseDown={onTitleBarMouseDown}
        refreshing={isRefreshing}
        onRefresh={onRefreshDisplays}
        onOpenSettings={() => onSetShowSettings(true)}
        onClose={onClose}
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
            onClick={() => onSetNotice(null)}
            title="Dismiss"
            aria-label="Dismiss"
          />
        </div>
      ) : null}

      <div className="main-layout">
        <DeviceNav
          displays={displays}
          selectedIndex={selectedIndex}
          onSelect={onSelectDisplay}
        />

        <section className="content">
          <BrightnessSlider
            value={currentPercentage}
            displayName={selectedDisplay?.name ?? "Unknown display"}
            disabled={!hdrActive || isHdrPending}
            onChange={onSliderChange}
            onPointerDown={onSliderDown}
            onCommit={onSliderCommit}
            onWheelAdjust={onSliderWheel}
          />
          <StatusBar
            hdrSupported={selectedDisplay?.hdr_supported ?? false}
            hdrActive={hdrActive}
            hdrPending={isHdrPending}
            onToggleHdr={onToggleHdr}
          />
        </section>
      </div>

      <SettingsDialog
        open={showSettings}
        autostartEnabled={autostartEnabled}
        syncBrightnessEnabled={syncBrightnessEnabled}
        themePreference={themePreference}
        hotkeys={hotkeys}
        onClose={() => onSetShowSettings(false)}
        onToggleAutostart={onToggleAutostart}
        onToggleSyncBrightness={onToggleSyncBrightness}
        onChangeThemePreference={onChangeThemePreference}
        onUpdateHotkey={onUpdateHotkey}
        onResetHotkeys={onResetHotkeys}
        onShowAbout={() => onSetShowAbout(true)}
      />

      <AboutDialog
        open={showAbout}
        hotkeys={hotkeys}
        onClose={() => onSetShowAbout(false)}
      />

      <StartupInfoDialog
        open={showStartupInfo}
        displays={displays}
        onClose={onCloseStartupOverlay}
      />
    </div>
  );
});

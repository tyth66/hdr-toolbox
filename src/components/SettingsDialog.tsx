import { memo, useEffect, useState } from "react";
import { Button, Switch } from "@fluentui/react-components";
import { formatHotkeyLabel } from "../hotkeys";
import type { HotkeyConfig, ThemePreference } from "../types";

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

type SettingsDialogProps = {
  open: boolean;
  autostartEnabled: boolean;
  syncBrightnessEnabled: boolean;
  themePreference: ThemePreference;
  hotkeys: HotkeyConfig;
  hotkeyRecordingDirection: "increase" | "decrease" | null;
  hotkeyError: string | null;
  hotkeyErrorSeq: number;
  onClose: () => void;
  onToggleAutostart: () => Promise<void>;
  onToggleSyncBrightness: () => void;
  onChangeThemePreference: (preference: ThemePreference) => void;
  onStartHotkeyRecording: (direction: "increase" | "decrease") => void;
  onShowAbout: () => void;
};

export const SettingsDialog = memo(function SettingsDialog({
  open,
  autostartEnabled,
  syncBrightnessEnabled,
  themePreference,
  hotkeys,
  hotkeyRecordingDirection,
  hotkeyError,
  hotkeyErrorSeq,
  onClose,
  onToggleAutostart,
  onToggleSyncBrightness,
  onChangeThemePreference,
  onStartHotkeyRecording,
  onShowAbout,
}: SettingsDialogProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
    if (!hotkeyError) return;
    const timer = setTimeout(() => setDismissed(true), 3000);
    return () => clearTimeout(timer);
  }, [hotkeyError, hotkeyErrorSeq]);

  const errorMessage = dismissed ? null : hotkeyError;

  if (!open) {
    return null;
  }

  return (
    <div className="dialog-overlay" onClick={onClose} role="presentation">
      <div
        className="dialog-shell"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
      >
        {errorMessage && (
          <div
            className="settings-notice-banner"
            onClick={() => setDismissed(true)}
            role="alert"
          >
            <span>{errorMessage}</span>
          </div>
        )}
        <h2 id="settings-dialog-title">Settings</h2>
        <div className="settings-section">
          <section className="settings-group">
            <div className="settings-row">
              <span>Auto-start</span>
              <Switch
                className="accent-switch settings-switch"
                checked={autostartEnabled}
                onChange={() => {
                  onToggleAutostart();
                }}
                aria-label="Toggle auto-start"
              />
            </div>
          </section>

          <section className="settings-group">
            <div className="settings-row settings-row-column">
              <span>Theme</span>
              <div className="theme-segmented" role="radiogroup" aria-label="Theme">
                {THEME_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    className={`theme-option ${themePreference === option.value ? "active" : ""}`}
                    appearance="subtle"
                    size="small"
                    role="radio"
                    aria-checked={themePreference === option.value}
                    onClick={() => onChangeThemePreference(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </section>

          <section className="settings-group">
            <div className="settings-row">
              <span>Sync all displays</span>
              <Switch
                className="accent-switch settings-switch"
                checked={syncBrightnessEnabled}
                onChange={onToggleSyncBrightness}
                aria-label="Toggle synced brightness"
              />
            </div>
          </section>

          <section className="settings-group">
            <div className="settings-row">
              <span>Brightness +</span>
              <Button
                className={`btn shortcut-btn ${hotkeyRecordingDirection === "increase" ? "shortcut-btn-recording" : ""}`}
                appearance="secondary"
                size="small"
                onClick={() => onStartHotkeyRecording("increase")}
                aria-label="Set brightness increase shortcut"
              >
                {hotkeyRecordingDirection === "increase" ? "Press a shortcut..." : formatHotkeyLabel(hotkeys.increase)}
              </Button>
            </div>
            <div className="settings-row">
              <span>Brightness -</span>
              <Button
                className={`btn shortcut-btn ${hotkeyRecordingDirection === "decrease" ? "shortcut-btn-recording" : ""}`}
                appearance="secondary"
                size="small"
                onClick={() => onStartHotkeyRecording("decrease")}
                aria-label="Set brightness decrease shortcut"
              >
                {hotkeyRecordingDirection === "decrease" ? "Press a shortcut..." : formatHotkeyLabel(hotkeys.decrease)}
              </Button>
            </div>
          </section>

          <section className="settings-group">
            <div className="settings-row">
              <span>HDR Toolbox</span>
              <Button className="about-link" appearance="secondary" size="small" onClick={onShowAbout}>
                About
              </Button>
            </div>
          </section>
        </div>
        <div className="settings-footer">
          <Button className="btn-primary close-btn" appearance="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
});


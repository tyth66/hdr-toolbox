import { memo, useEffect, useState } from "react";
import { Button, Switch } from "@fluentui/react-components";
import { formatHotkeyFromEvent, formatHotkeyLabel } from "../hotkeys";
import type { HotkeyConfig, HotkeyDirection, ThemePreference } from "../types";

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
  onClose: () => void;
  onToggleAutostart: () => Promise<void>;
  onToggleSyncBrightness: () => void;
  onChangeThemePreference: (preference: ThemePreference) => void;
  onUpdateHotkey: (direction: HotkeyDirection, value: string) => boolean;
  onResetHotkeys: () => void;
  onShowAbout: () => void;
};

export const SettingsDialog = memo(function SettingsDialog({
  open,
  autostartEnabled,
  syncBrightnessEnabled,
  themePreference,
  hotkeys,
  onClose,
  onToggleAutostart,
  onToggleSyncBrightness,
  onChangeThemePreference,
  onUpdateHotkey,
  onResetHotkeys,
  onShowAbout,
}: SettingsDialogProps) {
  const [recording, setRecording] = useState<HotkeyDirection | null>(null);

  useEffect(() => {
    if (!open) {
      setRecording(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !recording) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape" && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
        setRecording(null);
        return;
      }

      const formatted = formatHotkeyFromEvent(event);
      if (!formatted) {
        return;
      }

      if (onUpdateHotkey(recording, formatted)) {
        setRecording(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onUpdateHotkey, open, recording]);

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
        <h2 id="settings-dialog-title">Settings</h2>
        <div className="settings-section">
          <section className="settings-group" aria-labelledby="settings-startup-heading">
            <h3 className="settings-heading" id="settings-startup-heading">Startup</h3>
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

          <section className="settings-group" aria-labelledby="settings-appearance-heading">
            <h3 className="settings-heading" id="settings-appearance-heading">Appearance</h3>
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

          <section className="settings-group" aria-labelledby="settings-brightness-heading">
            <h3 className="settings-heading" id="settings-brightness-heading">Brightness</h3>
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

          <section className="settings-group" aria-labelledby="settings-shortcuts-heading">
            <h3 className="settings-heading" id="settings-shortcuts-heading">Shortcuts</h3>
            <div className="settings-row">
              <span>Brightness +</span>
              <Button
                className={`btn shortcut-btn ${recording === "increase" ? "shortcut-btn-recording" : ""}`}
                appearance="secondary"
                size="small"
                onClick={() => setRecording(recording === "increase" ? null : "increase")}
                aria-label="Set brightness increase shortcut"
              >
                {recording === "increase" ? "Press a shortcut..." : formatHotkeyLabel(hotkeys.increase)}
              </Button>
            </div>
            <div className="settings-row">
              <span>Brightness -</span>
              <Button
                className={`btn shortcut-btn ${recording === "decrease" ? "shortcut-btn-recording" : ""}`}
                appearance="secondary"
                size="small"
                onClick={() => setRecording(recording === "decrease" ? null : "decrease")}
                aria-label="Set brightness decrease shortcut"
              >
                {recording === "decrease" ? "Press a shortcut..." : formatHotkeyLabel(hotkeys.decrease)}
              </Button>
            </div>
            <div className="settings-row">
              <span>Reset shortcuts</span>
              <Button className="settings-action" appearance="secondary" size="small" onClick={onResetHotkeys}>
                Reset
              </Button>
            </div>
          </section>

          <section className="settings-group" aria-labelledby="settings-about-heading">
            <h3 className="settings-heading" id="settings-about-heading">About</h3>
            <div className="settings-row">
              <span>HDR Toolbox</span>
              <Button className="about-link" appearance="subtle" size="small" onClick={onShowAbout}>
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

import { useEffect, useState } from "react";
import { formatHotkeyFromEvent, formatHotkeyLabel } from "../hotkeys";
import type { HotkeyConfig, HotkeyDirection } from "../types";

type SettingsDialogProps = {
  open: boolean;
  autostartEnabled: boolean;
  hotkeys: HotkeyConfig;
  onClose: () => void;
  onToggleAutostart: () => Promise<void>;
  onUpdateHotkey: (direction: HotkeyDirection, value: string) => boolean;
  onResetHotkeys: () => void;
  onShowAbout: () => void;
};

export function SettingsDialog({
  open,
  autostartEnabled,
  hotkeys,
  onClose,
  onToggleAutostart,
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
    <div className="about-overlay" onClick={onClose}>
      <div className="about-dialog" onClick={(event) => event.stopPropagation()}>
        <h2>Settings</h2>
        <div className="settings-section">
          <div className="settings-row">
            <span>Launch at sign-in</span>
            <button
              className={`hdr-toggle ${autostartEnabled ? "active" : ""}`}
              onClick={() => {
                onToggleAutostart().catch(() => {});
              }}
            >
              <span className="toggle-thumb" />
            </button>
          </div>
          <div className="settings-row">
            <span>Brightness up</span>
            <button
              className={`btn shortcut-btn ${recording === "increase" ? "shortcut-btn-recording" : ""}`}
              onClick={() => setRecording(recording === "increase" ? null : "increase")}
            >
              {recording === "increase" ? "Press a shortcut..." : formatHotkeyLabel(hotkeys.increase)}
            </button>
          </div>
          <div className="settings-row">
            <span>Brightness down</span>
            <button
              className={`btn shortcut-btn ${recording === "decrease" ? "shortcut-btn-recording" : ""}`}
              onClick={() => setRecording(recording === "decrease" ? null : "decrease")}
            >
              {recording === "decrease" ? "Press a shortcut..." : formatHotkeyLabel(hotkeys.decrease)}
            </button>
          </div>
          <div className="settings-row">
            <span>Reset shortcuts</span>
            <button className="btn" onClick={onResetHotkeys}>
              Reset
            </button>
          </div>
        </div>
        <p style={{ fontSize: "11px", color: "#999", marginTop: "8px" }}>
          v1.0.0 |{" "}
          <button className="about-link" onClick={onShowAbout}>
            About
          </button>
        </p>
        <button className="btn btn-primary close-btn" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

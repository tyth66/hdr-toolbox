import { memo } from "react";
import { formatHotkeyLabel } from "../hotkeys";
import { HOTKEYS, type HotkeyConfig } from "../types";

type AboutDialogProps = {
  open: boolean;
  hotkeys: HotkeyConfig;
  onClose: () => void;
};

export const AboutDialog = memo(function AboutDialog({ open, hotkeys, onClose }: AboutDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="about-overlay" onClick={onClose} role="presentation">
      <div
        className="about-dialog"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-dialog-title"
      >
        <h2 id="about-dialog-title">HDR Toolbox</h2>
        <p>
          A lightweight tray app for adjusting SDR brightness on HDR-capable
          displays without opening Windows Settings.
        </p>
        <div className="shortcuts">
          <div>
            <strong>Left-click tray:</strong> Show or hide the window
          </div>
          <div>
            <strong>{formatHotkeyLabel(hotkeys.increase)}:</strong> +{HOTKEYS.STEP}%
          </div>
          <div>
            <strong>{formatHotkeyLabel(hotkeys.decrease)}:</strong> -{HOTKEYS.STEP}%
          </div>
        </div>
        <p style={{ fontSize: "11px", color: "#999" }}>v1.0.0 | MIT License</p>
        <button className="btn btn-primary close-btn" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
});

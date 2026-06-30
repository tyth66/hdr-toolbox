import { memo } from "react";
import { Button } from "@fluentui/react-components";
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
    <div className="dialog-overlay" onClick={onClose} role="presentation">
      <div
        className="dialog-shell"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-dialog-title"
      >
        <h2 id="about-dialog-title">BrightBox</h2>
        <p>
          A lightweight tray app for controlling supported display brightness
          without opening Windows Settings.
        </p>
        <div className="dialog-list">
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
        <p className="dialog-meta">v1.0.0 | MIT License</p>
        <Button className="btn-primary close-btn" appearance="primary" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
});

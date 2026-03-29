import { HOTKEYS } from "../types";

type AboutDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function AboutDialog({ open, onClose }: AboutDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-dialog" onClick={(event) => event.stopPropagation()}>
        <h2>HDR Toolbox</h2>
        <p>
          A lightweight tool for adjusting HDR monitor SDR brightness without
          opening Windows Settings.
        </p>
        <div className="shortcuts">
          <div>
            <strong>Left-click tray:</strong> Toggle slider
          </div>
          <div>
            <strong>{HOTKEYS.INCREASE}:</strong> +{HOTKEYS.STEP}%
          </div>
          <div>
            <strong>{HOTKEYS.DECREASE}:</strong> -{HOTKEYS.STEP}%
          </div>
        </div>
        <p style={{ fontSize: "11px", color: "#999" }}>v1.0.0 | MIT License</p>
        <button className="btn btn-primary close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

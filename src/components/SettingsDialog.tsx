type SettingsDialogProps = {
  open: boolean;
  autostartEnabled: boolean;
  onClose: () => void;
  onToggleAutostart: () => Promise<void>;
  onShowAbout: () => void;
  onQuit: () => Promise<void>;
};

export function SettingsDialog({
  open,
  autostartEnabled,
  onClose,
  onToggleAutostart,
  onShowAbout,
  onQuit,
}: SettingsDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-dialog" onClick={(event) => event.stopPropagation()}>
        <h2>Settings</h2>
        <div className="settings-section">
          <div className="settings-row">
            <span>Auto-start with Windows</span>
            <button
              className={`hdr-toggle ${autostartEnabled ? "active" : ""}`}
              onClick={() => {
                onToggleAutostart().catch((err) => {
                  console.error("Failed to toggle autostart:", err);
                });
              }}
            >
              <span className="toggle-thumb" />
            </button>
          </div>
          <div className="settings-row">
            <span>Quit HDR Toolbox</span>
            <button
              className="btn"
              style={{ background: "rgba(239,68,68,0.2)", color: "#f87171" }}
              onClick={() => {
                onQuit().catch((err) => {
                  console.error("Failed to quit:", err);
                });
              }}
            >
              Quit
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
          Close
        </button>
      </div>
    </div>
  );
}

type StatusBarProps = {
  hdrActive: boolean;
};

export function StatusBar({ hdrActive }: StatusBarProps) {
  return (
    <div className="status-bar">
      <div className="status-left">
        <div className={`status-indicator ${hdrActive ? "hdr-active" : ""}`} />
        <span className="status-text">
          {hdrActive ? "HDR10 Active" : "SDR Mode"}
        </span>
      </div>
      <div className="status-right">
        <span className="status-label">HDR Status</span>
        <button
          className={`hdr-toggle ${hdrActive ? "active" : ""}`}
          type="button"
          disabled
          title="HDR switching is not implemented in this build"
        >
          <span className="toggle-thumb" />
        </button>
      </div>
    </div>
  );
}

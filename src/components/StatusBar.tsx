type StatusBarProps = {
  hdrSupported: boolean;
  hdrActive: boolean;
  hdrPending?: boolean;
  onToggleHdr?: () => Promise<void>;
};

export function StatusBar({
  hdrSupported,
  hdrActive,
  hdrPending = false,
  onToggleHdr,
}: StatusBarProps) {
  const toggleDisabled = !hdrSupported || hdrPending;
  const title = !hdrSupported
    ? "HDR is not supported on the selected display"
    : hdrPending
      ? "Updating HDR state..."
      : hdrActive
        ? "Disable HDR"
        : "Enable HDR";

  return (
    <div className="status-bar">
      <div className="status-left">
        <div className={`status-indicator ${hdrActive ? "hdr-active" : ""}`} />
        <span className="status-text">
          {hdrSupported ? (hdrActive ? "HDR10 Active" : "HDR Available") : "SDR Only"}
        </span>
      </div>
      <div className="status-right">
        <span className="status-label">HDR Status</span>
        <button
          className={`hdr-toggle ${hdrActive ? "active" : ""}`}
          type="button"
          disabled={toggleDisabled}
          title={title}
          onClick={() => {
            onToggleHdr?.().catch(() => {});
          }}
        >
          <span className="toggle-thumb" />
        </button>
      </div>
    </div>
  );
}

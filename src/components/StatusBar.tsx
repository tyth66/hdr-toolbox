import { memo } from "react";

type StatusBarProps = {
  hdrSupported: boolean;
  hdrActive: boolean;
  hdrPending?: boolean;
  onToggleHdr?: () => Promise<void>;
};

export const StatusBar = memo(function StatusBar({
  hdrSupported,
  hdrActive,
  hdrPending = false,
  onToggleHdr,
}: StatusBarProps) {
  const toggleDisabled = !hdrSupported || hdrPending;
  const title = !hdrSupported
    ? "HDR is not available for this display"
    : hdrPending
      ? "Updating HDR setting..."
      : hdrActive
        ? "Disable HDR"
        : "Enable HDR";

  return (
    <div className="status-bar">
      <div className="status-left">
        <div className={`status-indicator ${hdrActive ? "hdr-active" : ""}`} />
        <span className="status-text">
          {hdrSupported ? (hdrActive ? "HDR On" : "HDR OFF") : "SDR Only"}
        </span>
      </div>
      <div className="status-right">
        <span className="status-label">HDR</span>
        <button
          className={`hdr-toggle ${hdrActive ? "active" : ""}`}
          type="button"
          disabled={toggleDisabled}
          title={title}
          onClick={() => {
            onToggleHdr?.();
          }}
        >
          <span className="toggle-thumb" />
        </button>
      </div>
    </div>
  );
});

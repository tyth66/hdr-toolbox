import { memo } from "react";
import { Switch } from "@fluentui/react-components";

type StatusBarProps = {
  hdrSupported: boolean;
  hdrActive: boolean;
  brightnessSourceLabel: string;
  hdrPending?: boolean;
  onToggleHdr?: () => Promise<void>;
};

export const StatusBar = memo(function StatusBar({
  hdrSupported,
  hdrActive,
  brightnessSourceLabel,
  hdrPending = false,
  onToggleHdr,
}: StatusBarProps) {
  const toggleDisabled = !hdrSupported || hdrPending;
  const label = hdrSupported
    ? hdrActive
      ? "HDR On"
      : "HDR Off"
    : brightnessSourceLabel;

  return (
    <div className="status-bar">
      <div className="status-left">
        <div className={`status-indicator ${hdrActive ? "hdr-active" : ""}`} />
        <span className="status-text">{label}</span>
      </div>
      <div className="status-right">
        <span className="status-label">HDR</span>
        <Switch
          className="accent-switch status-switch"
          checked={hdrActive}
          disabled={toggleDisabled}
          onChange={() => {
            onToggleHdr?.();
          }}
          aria-label={label}
        />
      </div>
    </div>
  );
});

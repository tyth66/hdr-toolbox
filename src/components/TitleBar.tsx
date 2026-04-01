import { memo, type MouseEventHandler } from "react";
import { SvgIcon } from "./SvgIcon";

type TitleBarProps = {
  onMouseDown?: MouseEventHandler<HTMLElement>;
  refreshing?: boolean;
  onRefresh?: () => Promise<void>;
  onOpenSettings?: () => void;
  onClose: () => void;
  minimal?: boolean;
};

export const TitleBar = memo(function TitleBar({
  onMouseDown,
  refreshing = false,
  onRefresh,
  onOpenSettings,
  onClose,
  minimal = false,
}: TitleBarProps) {
  return (
    <header className="title-bar" onMouseDown={onMouseDown}>
      <span className="title-bar-title">HDR Toolbox</span>
      {minimal ? (
        <button className="title-bar-close" onClick={onClose}>
          x
        </button>
      ) : (
        <div className="title-bar-actions">
          <button
            className="title-bar-btn"
            onClick={() => {
              onRefresh?.();
            }}
            title={refreshing ? "Refreshing display list..." : "Refresh display list"}
            disabled={refreshing}
            aria-label="Refresh display list"
          >
            <SvgIcon
              name={refreshing ? "spinner" : "refresh"}
              className={refreshing ? "ui-icon-spin" : undefined}
            />
          </button>
          <button
            className="title-bar-btn"
            onClick={onOpenSettings}
            title="Settings"
            aria-label="Open settings"
          >
            <SvgIcon name="settings" />
          </button>
          <button
            className="title-bar-btn title-bar-close"
            onClick={onClose}
            title="Close"
            aria-label="Close window"
          >
            <SvgIcon name="close" />
          </button>
        </div>
      )}
    </header>
  );
});

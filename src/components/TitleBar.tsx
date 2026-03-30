import type { MouseEventHandler } from "react";
import { SvgIcon } from "./SvgIcon";

type TitleBarProps = {
  onMouseDown?: MouseEventHandler<HTMLElement>;
  refreshing?: boolean;
  onRefresh?: () => Promise<void>;
  onOpenSettings?: () => void;
  onClose: () => void;
  minimal?: boolean;
};

export function TitleBar({
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
              onRefresh?.().catch(() => {});
            }}
            title={refreshing ? "Refreshing display list..." : "Refresh display list"}
            disabled={refreshing}
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
          >
            <SvgIcon name="settings" />
          </button>
          <button
            className="title-bar-btn title-bar-close"
            onClick={onClose}
            title="Close"
          >
            <SvgIcon name="close" />
          </button>
        </div>
      )}
    </header>
  );
}

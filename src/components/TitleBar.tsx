import type { MouseEventHandler } from "react";

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
              onRefresh?.().catch((err) => {
                console.error("Failed to refresh displays:", err);
              });
            }}
            title={refreshing ? "Refreshing..." : "Refresh Displays"}
            disabled={refreshing}
          >
            <span className="material-symbols-outlined">
              {refreshing ? "progress_activity" : "refresh"}
            </span>
          </button>
          <button
            className="title-bar-btn"
            onClick={onOpenSettings}
            title="Settings"
          >
            <span className="material-symbols-outlined">settings</span>
          </button>
          <button
            className="title-bar-btn title-bar-close"
            onClick={onClose}
            title="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}
    </header>
  );
}

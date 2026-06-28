import { memo, type MouseEventHandler } from "react";
import { Button } from "@fluentui/react-components";
import { SvgIcon } from "./SvgIcon";
import { ArrowSyncRegular, SettingsRegular, DismissRegular } from "@fluentui/react-icons";

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
        <Button
          className="title-bar-btn title-bar-close"
          appearance="subtle"
          size="small"
          icon={<DismissRegular />}
          onClick={onClose}
          title="Close"
          aria-label="Close window"
        />
      ) : (
        <div className="title-bar-actions">
          <Button
            className="title-bar-btn"
            appearance="subtle"
            size="small"
            icon={refreshing ? <SvgIcon name="spinner" className="ui-icon-spin" /> : <ArrowSyncRegular />}
            onClick={() => {
              onRefresh?.();
            }}
            title={refreshing ? "Refreshing display list..." : "Refresh display list"}
            disabled={refreshing}
            aria-label="Refresh display list"
          />
          <Button
            className="title-bar-btn"
            appearance="subtle"
            size="small"
            icon={<SettingsRegular />}
            onClick={onOpenSettings}
            title="Settings"
            aria-label="Open settings"
          />
          <Button
            className="title-bar-btn title-bar-close"
            appearance="subtle"
            size="small"
            icon={<DismissRegular />}
            onClick={onClose}
            title="Close"
            aria-label="Close window"
          />
        </div>
      )}
    </header>
  );
});

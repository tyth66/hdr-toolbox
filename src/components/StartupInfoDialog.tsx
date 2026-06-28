import { memo } from "react";
import { Button } from "@fluentui/react-components";
import type { DisplayInfo } from "../types";

type StartupInfoDialogProps = {
  open: boolean;
  displays: DisplayInfo[];
  onClose: () => void;
};

export const StartupInfoDialog = memo(function StartupInfoDialog({
  open,
  displays,
  onClose,
}: StartupInfoDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="dialog-overlay" onClick={onClose} role="presentation">
      <div
        className="dialog-shell"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="startup-dialog-title"
      >
        <h2 id="startup-dialog-title">HDR Toolbox</h2>
        <p>Found {displays.length} HDR-capable display{displays.length === 1 ? "" : "s"}:</p>
        <ul className="startup-display-list">
          {displays.map((display) => (
            <li
              key={`${display.adapter_id_low}-${display.adapter_id_high}-${display.target_id}`}
            >
              {display.name}: {display.nits} nits
            </li>
          ))}
        </ul>
        <p className="dialog-meta">Click anywhere outside to dismiss</p>
        <Button className="close-btn" appearance="secondary" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
});

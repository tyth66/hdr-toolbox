import type { DisplayInfo } from "../types";

type StartupInfoDialogProps = {
  open: boolean;
  displays: DisplayInfo[];
  onClose: () => void;
};

export function StartupInfoDialog({
  open,
  displays,
  onClose,
}: StartupInfoDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-dialog" onClick={(event) => event.stopPropagation()}>
        <h2>HDR Toolbox</h2>
        <p>Found {displays.length} HDR-capable display{displays.length === 1 ? "" : "s"}:</p>
        <ul style={{ textAlign: "left", margin: "8px 0", paddingLeft: "20px" }}>
          {displays.map((display) => (
            <li
              key={`${display.adapter_id_low}-${display.adapter_id_high}-${display.target_id}`}
              style={{ marginBottom: "4px" }}
            >
              {display.name}: {display.nits} nits
            </li>
          ))}
        </ul>
        <p style={{ fontSize: "11px", color: "#999" }}>Click anywhere outside to dismiss</p>
      </div>
    </div>
  );
}

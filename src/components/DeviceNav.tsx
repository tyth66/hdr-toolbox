import type { DisplayInfo } from "../types";

type DeviceNavProps = {
  displays: DisplayInfo[];
  selectedIndex: number;
  onSelect: (index: number) => void;
};

export function DeviceNav({
  displays,
  selectedIndex,
  onSelect,
}: DeviceNavProps) {
  return (
    <nav className="side-nav">
      {displays.map((display, idx) => (
        <button
          key={`${display.adapter_id_low}-${display.adapter_id_high}-${display.target_id}`}
          className={`side-nav-btn ${selectedIndex === idx ? "active" : ""}`}
          onClick={() => onSelect(idx)}
          title={display.name}
        >
          <span className="material-symbols-outlined">monitor</span>
        </button>
      ))}
    </nav>
  );
}

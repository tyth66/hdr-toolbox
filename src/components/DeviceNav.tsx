import { memo } from "react";
import type { DisplayInfo } from "../types";
import { SvgIcon } from "./SvgIcon";

type DeviceNavProps = {
  displays: DisplayInfo[];
  selectedIndex: number;
  onSelect: (index: number) => void;
};

export const DeviceNav = memo(function DeviceNav({
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
          aria-label={`Select display ${display.name}`}
        >
          <SvgIcon name="monitor" />
        </button>
      ))}
    </nav>
  );
});

import { type DisplayInfo, nitsToPercentage, percentageToNits } from "../types.ts";

export type SelectedDisplaySnapshot = {
  selectedIndex: number;
  currentPercentage: number;
  hdrActive: boolean;
};

export function getSelectedDisplaySnapshot(
  displays: DisplayInfo[],
  index: number
): SelectedDisplaySnapshot | null {
  if (index < 0 || index >= displays.length) {
    return null;
  }

  return {
    selectedIndex: index,
    currentPercentage: nitsToPercentage(displays[index].nits),
    hdrActive: displays[index].hdr_enabled,
  };
}

export function buildBrightnessUpdate(
  displays: DisplayInfo[],
  selectedIndex: number,
  percentage: number
): DisplayInfo[] {
  const nits = percentageToNits(percentage);
  return displays.map((display, index) =>
    index === selectedIndex ? { ...display, nits } : display
  );
}

export function findMatchingDisplayIndex(
  displays: DisplayInfo[],
  previousDisplay: DisplayInfo | null | undefined
): number {
  if (!previousDisplay) {
    return displays.length > 0 ? 0 : -1;
  }

  return displays.findIndex(
    (display) =>
      display.adapter_id_low === previousDisplay.adapter_id_low &&
      display.adapter_id_high === previousDisplay.adapter_id_high &&
      display.target_id === previousDisplay.target_id
  );
}

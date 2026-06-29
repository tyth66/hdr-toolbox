import { type DisplayInfo, percentageToNits } from "../types.ts";

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
    currentPercentage: displays[index].brightness,
    hdrActive: displays[index].hdr_enabled,
  };
}

export function buildBrightnessUpdate(
  displays: DisplayInfo[],
  selectedIndex: number,
  percentage: number
): DisplayInfo[] {
  return displays.map((display, index) => {
    if (index !== selectedIndex) {
      return display;
    }

    const brightness = Math.max(0, Math.min(100, percentage));
    const brightness_raw =
      display.brightness_source === "ddc_vcp"
        ? Math.round((brightness * (display.brightness_raw_max ?? 100)) / 100)
        : brightness;

    return {
      ...display,
      brightness,
      brightness_raw,
      nits:
        display.brightness_source === "hdr_sdr"
          ? percentageToNits(brightness)
          : display.nits,
    };
  });
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

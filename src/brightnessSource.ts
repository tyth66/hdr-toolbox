import type { BrightnessSource } from "./types";

export function getBrightnessSourceLabel(source: BrightnessSource): string {
  switch (source) {
    case "hdr_sdr":
      return "HDR SDR white level";
    case "ddc_high_level":
      return "DDC/CI brightness";
    case "ddc_vcp":
      return "DDC/CI VCP brightness";
    case "wmi":
      return "Internal display brightness";
  }
}

export function isHdrBrightnessSource(source: BrightnessSource): boolean {
  return source === "hdr_sdr";
}

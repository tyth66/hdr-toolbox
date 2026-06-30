import type { BrightnessSource } from "../types";

export function isBrightnessAdjustable(
  source: BrightnessSource,
  hdrActive: boolean,
  isHdrPending: boolean
): boolean {
  if (isHdrPending) {
    return false;
  }

  return source === "hdr_sdr" ? hdrActive : true;
}

import { useMemo } from "react";
import {
  getHdrDisplays,
  refreshCachedDisplays,
  refreshKnownDisplayState,
  setBrightness as setDisplayBrightness,
  setBrightnessAll,
  setHdrEnabled,
  type BrightnessAllOutcome,
} from "../services/tauriApi";
import type { DisplayInfo } from "../types";

export type DisplayCommandClient = {
  getDisplays: () => Promise<DisplayInfo[]>;
  refreshCachedDisplays: () => Promise<DisplayInfo[]>;
  refreshKnownDisplayState: () => Promise<DisplayInfo[]>;
  setBrightness: (
    display: DisplayInfo,
    percentage: number
  ) => Promise<DisplayInfo[]>;
  setBrightnessAll: (
    percentage: number
  ) => Promise<BrightnessAllOutcome>;
  setHdrEnabled: (
    display: DisplayInfo,
    enabled: boolean
  ) => Promise<DisplayInfo[]>;
};

export function useDisplayCommandClient(): DisplayCommandClient {
  return useMemo(
    () => ({
      getDisplays: getHdrDisplays,
      refreshCachedDisplays,
      refreshKnownDisplayState,
      setBrightness: (display, percentage) =>
        setDisplayBrightness(
          display.adapter_id_low,
          display.adapter_id_high,
          display.target_id,
          percentage,
          display.min_nits ?? 80,
          display.max_nits ?? 480
        ),
      setBrightnessAll,
      setHdrEnabled: (display, enabled) =>
        setHdrEnabled(
          display.adapter_id_low,
          display.adapter_id_high,
          display.target_id,
          enabled
        ),
    }),
    []
  );
}

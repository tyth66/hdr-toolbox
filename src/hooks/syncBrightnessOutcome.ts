import type { AppNotice } from "../errors";
import type { BrightnessAllOutcome } from "../services/tauriApi";
import type { DisplayInfo } from "../types";
import { findMatchingDisplayIndex } from "./displayState";

type SyncBrightnessOutcomeUpdate = {
  displays: DisplayInfo[];
  selectedIndex: number;
  notice: AppNotice | null;
};

export function buildSyncBrightnessOutcomeUpdate(
  previousDisplay: DisplayInfo,
  outcome: BrightnessAllOutcome
): SyncBrightnessOutcomeUpdate {
  const selectedIndex = findMatchingDisplayIndex(
    outcome.displays,
    previousDisplay
  );
  const failureCount = outcome.failures.length;

  return {
    displays: outcome.displays,
    selectedIndex,
    notice:
      failureCount > 0
        ? {
            title: "Some displays were not updated",
            message: `${failureCount} display${failureCount === 1 ? "" : "s"} could not apply the synced brightness.`,
          }
        : null,
  };
}

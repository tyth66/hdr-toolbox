import { useCallback, useRef, type MutableRefObject } from "react";
import { loadSyncBrightnessEnabled } from "../syncBrightness";
import { SLIDER, type DisplayInfo } from "../types";
import type { DisplayCommandClient } from "./useDisplayCommandClient";
import type { DisplayFeedbackController } from "./useDisplayFeedbackState";
import { findMatchingDisplayIndex } from "./displayState";
import { buildSyncBrightnessOutcomeUpdate } from "./syncBrightnessOutcome";

type UseDisplayDeviceActionsOptions = {
  displaysRef: MutableRefObject<DisplayInfo[]>;
  selectedIndexRef: MutableRefObject<number>;
  selectDisplay: (idx: number, source?: DisplayInfo[]) => void;
  syncDisplayState: (updatedDisplays: DisplayInfo[]) => void;
  previewPercentage: (percentage: number) => void;
  commands: DisplayCommandClient;
  feedback: DisplayFeedbackController;
  showWindow: () => Promise<void>;
  startStartupOverlay: () => Promise<void>;
};

export function useDisplayDeviceActions({
  displaysRef,
  selectedIndexRef,
  selectDisplay,
  syncDisplayState,
  previewPercentage,
  commands,
  feedback,
  showWindow,
  startStartupOverlay,
}: UseDisplayDeviceActionsOptions) {
  const refreshInFlightRef = useRef(false);

  const applyBrightness = useCallback(
    async (percentage: number) => {
      try {
        const idx = selectedIndexRef.current;
        const display = displaysRef.current[idx];
        if (!display) {
          return;
        }

        const clampedPercentage = Math.max(
          SLIDER.MIN,
          Math.min(SLIDER.MAX, percentage)
        );

        if (loadSyncBrightnessEnabled()) {
          const outcome = await commands.setBrightnessAll(clampedPercentage);
          const update = buildSyncBrightnessOutcomeUpdate(display, outcome);

          syncDisplayState(update.displays);
          if (update.selectedIndex >= 0) {
            selectDisplay(update.selectedIndex, update.displays);
          }
          feedback.setNotice(update.notice);
          return;
        }

        const updatedDisplays = await commands.setBrightness(
          display,
          clampedPercentage
        );

        previewPercentage(clampedPercentage);
        syncDisplayState(updatedDisplays);
        feedback.clearNotice();
      } catch (err) {
        feedback.reportBrightnessError();
        throw err;
      }
    },
    [
      commands,
      displaysRef,
      feedback,
      previewPercentage,
      selectDisplay,
      selectedIndexRef,
      syncDisplayState,
    ]
  );

  const refreshDisplays = useCallback(
    async (options?: { initial?: boolean; silent?: boolean }) => {
      const { initial = false, silent = false } = options ?? {};
      const previousDisplay = displaysRef.current[selectedIndexRef.current];

      if (refreshInFlightRef.current) {
        return;
      }

      try {
        refreshInFlightRef.current = true;
        feedback.beginRefresh({ initial, silent });

        const result = await commands.getDisplays();
        syncDisplayState(result);

        if (result.length > 0) {
          const matchedIndex = findMatchingDisplayIndex(result, previousDisplay);
          selectDisplay(matchedIndex >= 0 ? matchedIndex : 0, result);

          if (initial) {
            await startStartupOverlay();
            await showWindow();
          }

          feedback.clearNotice();
        }
      } catch (err) {
        if (initial) {
          feedback.reportInitialLoadError(err);
          syncDisplayState([]);
        } else {
          feedback.reportRefreshError(err, silent);
        }
      } finally {
        refreshInFlightRef.current = false;
        feedback.finishRefresh({ initial, silent });
      }
    },
    [
      commands,
      displaysRef,
      feedback,
      selectDisplay,
      selectedIndexRef,
      showWindow,
      startStartupOverlay,
      syncDisplayState,
    ]
  );

  const loadDisplays = useCallback(async () => {
    await refreshDisplays({ initial: true });
  }, [refreshDisplays]);

  const toggleHdr = useCallback(async () => {
    const display = displaysRef.current[selectedIndexRef.current];
    if (!display || !display.hdr_supported) {
      return;
    }

    try {
      feedback.setHdrPending(true);
      const result = await commands.setHdrEnabled(display, !display.hdr_enabled);

      syncDisplayState(result);
      if (result.length > 0) {
        const matchedIndex = findMatchingDisplayIndex(result, display);
        selectDisplay(matchedIndex >= 0 ? matchedIndex : 0, result);
      }
      feedback.clearNotice();
    } catch (err) {
      feedback.reportHdrToggleError();
      throw err;
    } finally {
      feedback.setHdrPending(false);
    }
  }, [
    commands,
    displaysRef,
    feedback,
    selectDisplay,
    selectedIndexRef,
    syncDisplayState,
  ]);

  return {
    applyBrightness,
    refreshDisplays,
    loadDisplays,
    toggleHdr,
  };
}

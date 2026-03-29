import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { mapBrightnessError, mapHdrToggleError, mapInitialLoadError, mapRefreshError, type AppNotice } from "../errors";
import { getHdrDisplays, setBrightness, setHdrEnabled } from "../services/tauriApi";
import { SLIDER, type DisplayInfo } from "../types";
import { findMatchingDisplayIndex } from "./displayState";

type UseDisplayDeviceActionsOptions = {
  displaysRef: MutableRefObject<DisplayInfo[]>;
  selectedIndexRef: MutableRefObject<number>;
  currentPercentageRef: MutableRefObject<number>;
  selectDisplay: (idx: number, source?: DisplayInfo[]) => void;
  syncDisplayState: (updatedDisplays: DisplayInfo[]) => void;
  setCurrentPercentage: Dispatch<SetStateAction<number>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setIsRefreshing: Dispatch<SetStateAction<boolean>>;
  setIsHdrPending: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<AppNotice | null>>;
  showWindow: () => Promise<void>;
  startStartupOverlay: () => Promise<void>;
};

export function useDisplayDeviceActions({
  displaysRef,
  selectedIndexRef,
  currentPercentageRef,
  selectDisplay,
  syncDisplayState,
  setCurrentPercentage,
  setLoading,
  setIsRefreshing,
  setIsHdrPending,
  setError,
  setNotice,
  showWindow,
  startStartupOverlay,
}: UseDisplayDeviceActionsOptions) {
  const refreshInFlightRef = useRef(false);

  const applyBrightness = useCallback(
    async (percentage: number) => {
      try {
        const idx = selectedIndexRef.current;
        const display = displaysRef.current[idx];
        if (!display || !display.hdr_enabled) {
          return;
        }

        const clampedPercentage = Math.max(
          SLIDER.MIN,
          Math.min(SLIDER.MAX, percentage)
        );

        const updatedDisplays = await setBrightness(
          display.adapter_id_low,
          display.adapter_id_high,
          display.target_id,
          clampedPercentage,
          display.min_nits ?? 80,
          display.max_nits ?? 480
        );

        setCurrentPercentage(clampedPercentage);
        currentPercentageRef.current = clampedPercentage;
        syncDisplayState(updatedDisplays);
        setNotice(null);
      } catch (err) {
        setNotice(mapBrightnessError());
        throw err;
      }
    },
    [
      currentPercentageRef,
      displaysRef,
      selectedIndexRef,
      setCurrentPercentage,
      setNotice,
      syncDisplayState,
    ]
  );

  const refreshDisplays = useCallback(async (options?: {
    initial?: boolean;
    silent?: boolean;
  }) => {
    const { initial = false, silent = false } = options ?? {};
    const previousDisplay = displaysRef.current[selectedIndexRef.current];

    if (refreshInFlightRef.current) {
      return;
    }

    try {
      refreshInFlightRef.current = true;
      if (initial) {
        setLoading(true);
        setError(null);
        setNotice(null);
      } else {
        setIsRefreshing(true);
      }

      const result = await getHdrDisplays();
      syncDisplayState(result);

      if (result.length > 0) {
        const matchedIndex = findMatchingDisplayIndex(result, previousDisplay);
        selectDisplay(matchedIndex >= 0 ? matchedIndex : 0, result);

        if (initial) {
          await startStartupOverlay();
          await showWindow();
        }

        setNotice(null);
      }
    } catch (err) {
      if (initial) {
        setError(mapInitialLoadError(err));
        syncDisplayState([]);
      } else {
        setNotice(mapRefreshError(err, silent));
      }
    } finally {
      refreshInFlightRef.current = false;
      if (initial) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, [
    displaysRef,
    selectDisplay,
    selectedIndexRef,
    setError,
    setIsRefreshing,
    setLoading,
    setNotice,
    showWindow,
    startStartupOverlay,
    syncDisplayState,
  ]);

  const loadDisplays = useCallback(async () => {
    await refreshDisplays({ initial: true });
  }, [refreshDisplays]);

  const toggleHdr = useCallback(async () => {
    const display = displaysRef.current[selectedIndexRef.current];
    if (!display || !display.hdr_supported) {
      return;
    }

    try {
      setIsHdrPending(true);
      const result = await setHdrEnabled(
        display.adapter_id_low,
        display.adapter_id_high,
        display.target_id,
        !display.hdr_enabled
      );

      syncDisplayState(result);
      if (result.length > 0) {
        const matchedIndex = findMatchingDisplayIndex(result, display);
        selectDisplay(matchedIndex >= 0 ? matchedIndex : 0, result);
      }
      setNotice(null);
    } catch (err) {
      setNotice(mapHdrToggleError());
      throw err;
    } finally {
      setIsHdrPending(false);
    }
  }, [
    displaysRef,
    selectDisplay,
    selectedIndexRef,
    setIsHdrPending,
    setNotice,
    syncDisplayState,
  ]);

  return {
    applyBrightness,
    refreshDisplays,
    loadDisplays,
    toggleHdr,
  };
}

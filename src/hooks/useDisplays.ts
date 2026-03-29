import { useCallback, useEffect, useRef, useState } from "react";
import {
  getHdrDisplays,
  setBrightness,
  updateDisplaysAndTooltip,
} from "../services/tauriApi";
import {
  type DisplayInfo,
  SLIDER,
} from "../types";
import {
  buildBrightnessUpdate,
  findMatchingDisplayIndex,
  getSelectedDisplaySnapshot,
} from "./displayState";

type UseDisplaysOptions = {
  showWindow: () => Promise<void>;
  startStartupOverlay: () => Promise<void>;
};

export function useDisplays({
  showWindow,
  startStartupOverlay,
}: UseDisplaysOptions) {
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentPercentage, setCurrentPercentage] = useState(50);
  const [hdrActive, setHdrActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displaysRef = useRef<DisplayInfo[]>([]);
  const selectedIndexRef = useRef(0);
  const currentPercentageRef = useRef(50);
  const refreshInFlightRef = useRef(false);

  useEffect(() => {
    displaysRef.current = displays;
  }, [displays]);

  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  useEffect(() => {
    currentPercentageRef.current = currentPercentage;
  }, [currentPercentage]);

  const selectDisplay = useCallback((idx: number, source = displaysRef.current) => {
    const snapshot = getSelectedDisplaySnapshot(source, idx);
    if (!snapshot) {
      return;
    }

    setSelectedIndex(snapshot.selectedIndex);
    selectedIndexRef.current = snapshot.selectedIndex;
    setCurrentPercentage(snapshot.currentPercentage);
    currentPercentageRef.current = snapshot.currentPercentage;
    setHdrActive(snapshot.hdrActive);
  }, []);

  const syncDisplayState = useCallback(async (updatedDisplays: DisplayInfo[]) => {
    setDisplays(updatedDisplays);
    displaysRef.current = updatedDisplays;
    await updateDisplaysAndTooltip(updatedDisplays);
  }, []);

  const applyBrightness = useCallback(
    async (percentage: number) => {
      const idx = selectedIndexRef.current;
      const display = displaysRef.current[idx];
      if (!display) {
        return;
      }

      const clampedPercentage = Math.max(
        SLIDER.MIN,
        Math.min(SLIDER.MAX, percentage)
      );

      await setBrightness(
        display.adapter_id_low,
        display.adapter_id_high,
        display.target_id,
        clampedPercentage,
        display.min_nits ?? 80,
        display.max_nits ?? 480
      );

      setCurrentPercentage(clampedPercentage);
      currentPercentageRef.current = clampedPercentage;
      const updatedDisplays = buildBrightnessUpdate(
        displaysRef.current,
        idx,
        clampedPercentage
      );
      await syncDisplayState(updatedDisplays);
    },
    [syncDisplayState]
  );

  const previewPercentage = useCallback((percentage: number) => {
    setCurrentPercentage(percentage);
    currentPercentageRef.current = percentage;
  }, []);

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
      } else {
        setIsRefreshing(true);
      }

      const result = await getHdrDisplays();
      await syncDisplayState(result);

      if (result.length > 0) {
        const matchedIndex = findMatchingDisplayIndex(result, previousDisplay);
        selectDisplay(matchedIndex >= 0 ? matchedIndex : 0, result);

        if (initial) {
          await startStartupOverlay();
          await showWindow();
        }
      }
    } catch (err) {
      if (initial) {
        setError(String(err));
        setDisplays([]);
        displaysRef.current = [];
        await updateDisplaysAndTooltip([]);
      } else if (!silent) {
        console.error("Failed to refresh displays:", err);
      }
    } finally {
      refreshInFlightRef.current = false;
      if (initial) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, [selectDisplay, showWindow, startStartupOverlay, syncDisplayState]);

  const loadDisplays = useCallback(async () => {
    await refreshDisplays({ initial: true });
  }, [refreshDisplays]);

  return {
    displays,
    displaysRef,
    selectedIndex,
    selectedIndexRef,
    currentPercentage,
    currentPercentageRef,
    hdrActive,
    loading,
    isRefreshing,
    error,
    loadDisplays,
    refreshDisplays,
    selectDisplay,
    previewPercentage,
    applyBrightness,
  };
}

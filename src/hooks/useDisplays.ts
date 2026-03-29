import { useCallback, useEffect, useRef, useState } from "react";
import {
  getHdrDisplays,
  setBrightness,
  updateDisplaysAndTooltip,
} from "../services/tauriApi";
import {
  type DisplayInfo,
  SLIDER,
  nitsToPercentage,
  percentageToNits,
} from "../types";

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
  const [error, setError] = useState<string | null>(null);

  const displaysRef = useRef<DisplayInfo[]>([]);
  const selectedIndexRef = useRef(0);
  const currentPercentageRef = useRef(50);

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
    if (idx < 0 || idx >= source.length) {
      return;
    }

    setSelectedIndex(idx);
    selectedIndexRef.current = idx;

    const percentage = nitsToPercentage(source[idx].nits);
    setCurrentPercentage(percentage);
    currentPercentageRef.current = percentage;
    setHdrActive(source[idx].hdr_enabled);
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

      const nits = percentageToNits(clampedPercentage);
      const updatedDisplays = displaysRef.current.map((item, itemIndex) =>
        itemIndex === idx ? { ...item, nits } : item
      );
      await syncDisplayState(updatedDisplays);
    },
    [syncDisplayState]
  );

  const previewPercentage = useCallback((percentage: number) => {
    setCurrentPercentage(percentage);
    currentPercentageRef.current = percentage;
  }, []);

  const loadDisplays = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getHdrDisplays();
      await syncDisplayState(result);

      if (result.length > 0) {
        selectDisplay(0, result);
        await startStartupOverlay();
        await showWindow();
      }
    } catch (err) {
      setError(String(err));
      setDisplays([]);
      displaysRef.current = [];
      await updateDisplaysAndTooltip([]);
    } finally {
      setLoading(false);
    }
  }, [selectDisplay, showWindow, startStartupOverlay, syncDisplayState]);

  return {
    displays,
    displaysRef,
    selectedIndex,
    selectedIndexRef,
    currentPercentage,
    currentPercentageRef,
    hdrActive,
    loading,
    error,
    loadDisplays,
    selectDisplay,
    previewPercentage,
    applyBrightness,
  };
}

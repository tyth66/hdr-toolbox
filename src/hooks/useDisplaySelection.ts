import { useCallback, useEffect, useRef, useState } from "react";
import type { DisplayInfo } from "../types";
import { getSelectedDisplaySnapshot } from "./displayState";

export function useDisplaySelection() {
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentPercentage, setCurrentPercentage] = useState(50);
  const [hdrActive, setHdrActive] = useState(false);

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

  const syncDisplayState = useCallback((updatedDisplays: DisplayInfo[]) => {
    setDisplays(updatedDisplays);
    displaysRef.current = updatedDisplays;
  }, []);

  const previewPercentage = useCallback((percentage: number) => {
    setCurrentPercentage(percentage);
    currentPercentageRef.current = percentage;
  }, []);

  return {
    displays,
    displaysRef,
    selectedIndex,
    selectedIndexRef,
    currentPercentage,
    currentPercentageRef,
    hdrActive,
    syncDisplayState,
    selectDisplay,
    previewPercentage,
    setCurrentPercentage,
    setHdrActive,
  };
}

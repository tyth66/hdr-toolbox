import { useState } from "react";
import {
  type AppNotice,
} from "../errors";
import { useDisplayDeviceActions } from "./useDisplayDeviceActions";
import { useDisplaySelection } from "./useDisplaySelection";

type UseDisplaysOptions = {
  showWindow: () => Promise<void>;
  startStartupOverlay: () => Promise<void>;
};

export function useDisplays({
  showWindow,
  startStartupOverlay,
}: UseDisplaysOptions) {
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHdrPending, setIsHdrPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<AppNotice | null>(null);

  const {
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
  } = useDisplaySelection();

  const {
    applyBrightness,
    refreshDisplays,
    loadDisplays,
    toggleHdr,
  } = useDisplayDeviceActions({
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
  });

  return {
    displays,
    displaysRef,
    selectedIndex,
    selectedIndexRef,
    currentPercentage,
    currentPercentageRef,
    hdrActive,
    isHdrPending,
    loading,
    isRefreshing,
    error,
    notice,
    setNotice,
    loadDisplays,
    refreshDisplays,
    toggleHdr,
    selectDisplay,
    previewPercentage,
    applyBrightness,
  };
}

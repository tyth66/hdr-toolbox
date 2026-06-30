import { useDisplayCommandClient } from "./useDisplayCommandClient";
import { useDisplayDeviceActions } from "./useDisplayDeviceActions";
import { useDisplayFeedbackState } from "./useDisplayFeedbackState";
import { useDisplayStateStore } from "./useDisplayStateStore";

type UseDisplaysOptions = {
  showWindow: () => Promise<void>;
  startStartupOverlay: () => Promise<void>;
};

export function useDisplays({
  showWindow,
  startStartupOverlay,
}: UseDisplaysOptions) {
  const displayState = useDisplayStateStore();
  const displayFeedback = useDisplayFeedbackState();
  const displayCommands = useDisplayCommandClient();

  const {
    applyBrightness,
    refreshDisplays,
    refreshCachedDisplays,
    refreshKnownDisplayState,
    loadDisplays,
    toggleHdr,
  } = useDisplayDeviceActions({
    displaysRef: displayState.displaysRef,
    selectedIndexRef: displayState.selectedIndexRef,
    selectDisplay: displayState.selectDisplay,
    syncDisplayState: displayState.syncDisplayState,
    previewPercentage: displayState.previewPercentage,
    commands: displayCommands,
    feedback: displayFeedback.feedback,
    showWindow,
    startStartupOverlay,
  });

  return {
    displays: displayState.displays,
    displaysRef: displayState.displaysRef,
    selectedIndex: displayState.selectedIndex,
    selectedIndexRef: displayState.selectedIndexRef,
    currentPercentage: displayState.currentPercentage,
    currentPercentageRef: displayState.currentPercentageRef,
    hdrActive: displayState.hdrActive,
    isHdrPending: displayFeedback.isHdrPending,
    loading: displayFeedback.loading,
    isRefreshing: displayFeedback.isRefreshing,
    error: displayFeedback.error,
    notice: displayFeedback.notice,
    setNotice: displayFeedback.setNotice,
    loadDisplays,
    refreshDisplays,
    refreshCachedDisplays,
    refreshKnownDisplayState,
    toggleHdr,
    selectDisplay: displayState.selectDisplay,
    previewPercentage: displayState.previewPercentage,
    applyBrightness,
  };
}

import { useEffect, type RefObject } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { AppNotice } from "../errors";
import { useDialogController } from "./useDialogController";
import { useHotkeyController } from "./useHotkeyController";
import { useSettingsController } from "./useSettingsController";
import { useTrayDisplayEvents } from "./useTrayDisplayEvents";

type UseAppControllerOptions = {
  loadDisplays: () => Promise<void>;
  refreshKnownDisplayState: (options?: { initial?: boolean; silent?: boolean }) => Promise<void>;
  selectDisplay: (idx: number) => void;
  showWindow: () => Promise<void>;
  currentPercentageRef: RefObject<number>;
  applyBrightness: (percentage: number) => Promise<void>;
  setNotice: (notice: AppNotice | null) => void;
};

export function useAppController({
  loadDisplays,
  refreshKnownDisplayState,
  selectDisplay,
  showWindow,
  currentPercentageRef,
  applyBrightness,
  setNotice,
}: UseAppControllerOptions) {
  const dialogs = useDialogController();
  const settings = useSettingsController({ setNotice });
  const hotkeys = useHotkeyController({
    currentPercentageRef,
    applyBrightness,
    setNotice,
  });

  useTrayDisplayEvents({
    loadDisplays,
    refreshKnownDisplayState,
    selectDisplay,
    showWindow,
  });

  useEffect(() => {
    let unlistenFocus: (() => void) | null = null;

    const setupFocusListener = async () => {
      try {
        const win = getCurrentWindow();
        unlistenFocus = await win.onFocusChanged(({ payload: focused }) => {
          if (focused) {
            refreshKnownDisplayState({ silent: true });
          }
        });
      } catch {
        // Ignore focus-listener setup failures; tray wake still refreshes state.
      }
    };

    setupFocusListener();

    return () => {
      if (unlistenFocus) {
        unlistenFocus();
      }
    };
  }, [refreshKnownDisplayState]);

  return {
    ...dialogs,
    ...settings,
    ...hotkeys,
  };
}

import type { RefObject } from "react";
import type { AppNotice } from "../errors";
import { useDialogController } from "./useDialogController";
import { useHotkeyController } from "./useHotkeyController";
import { useSettingsController } from "./useSettingsController";
import { useTrayDisplayEvents } from "./useTrayDisplayEvents";

type UseAppControllerOptions = {
  loadDisplays: () => Promise<void>;
  refreshDisplays: (options?: { initial?: boolean; silent?: boolean }) => Promise<void>;
  selectDisplay: (idx: number) => void;
  showWindow: () => Promise<void>;
  currentPercentageRef: RefObject<number>;
  applyBrightness: (percentage: number) => Promise<void>;
  setNotice: (notice: AppNotice | null) => void;
};

export function useAppController({
  loadDisplays,
  refreshDisplays,
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
    refreshDisplays,
    selectDisplay,
    showWindow,
  });

  return {
    ...dialogs,
    ...settings,
    ...hotkeys,
  };
}

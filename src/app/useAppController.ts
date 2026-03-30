import { useCallback, useEffect, useState, type RefObject } from "react";
import { listen } from "@tauri-apps/api/event";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import {
  mapAutostartError,
  mapHotkeyRegistrationError,
  mapHotkeyValidationError,
  type AppNotice,
} from "../errors";
import {
  getDefaultHotkeys,
  loadHotkeys,
  normalizeHotkeyShortcut,
  saveHotkeys,
  validateHotkeys,
} from "../hotkeys";
import { useHotkeys } from "../hooks/useHotkeys";
import type { HotkeyConfig, HotkeyDirection } from "../types";

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
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [hotkeys, setHotkeys] = useState<HotkeyConfig>(() => loadHotkeys());

  const handleHotkeyRegistrationError = useCallback(() => {
    setNotice(mapHotkeyRegistrationError());
  }, [setNotice]);

  useHotkeys({
    currentPercentageRef,
    applyBrightness,
    hotkeys,
    onRegistrationError: handleHotkeyRegistrationError,
  });

  useEffect(() => {
    loadDisplays();

    isEnabled().then(setAutostartEnabled).catch((err) => {
      console.warn("Failed to get autostart status:", err);
    });

    const unlistenShowWindow = listen("show-window", async () => {
      await showWindow();
      await refreshDisplays({ silent: true });
    });

    const unlistenSelectDisplay = listen<number>("select-display", (event) => {
      selectDisplay(event.payload);
    });

    return () => {
      unlistenShowWindow.then((fn) => fn());
      unlistenSelectDisplay.then((fn) => fn());
    };
  }, [loadDisplays, refreshDisplays, selectDisplay, showWindow]);

  const handleToggleAutostart = useCallback(async () => {
    try {
      if (autostartEnabled) {
        await disable();
        setAutostartEnabled(false);
      } else {
        await enable();
        setAutostartEnabled(true);
      }
      setNotice(null);
    } catch (err) {
      console.error("Failed to toggle autostart:", err);
      setNotice(mapAutostartError());
    }
  }, [autostartEnabled, setNotice]);

  const handleHotkeyChange = useCallback((direction: HotkeyDirection, value: string) => {
    const nextHotkeys = {
      ...hotkeys,
      [direction]: normalizeHotkeyShortcut(value),
    };

    const validationError = validateHotkeys(nextHotkeys);
    if (validationError) {
      setNotice(mapHotkeyValidationError(validationError));
      return false;
    }

    setHotkeys(nextHotkeys);
    saveHotkeys(nextHotkeys);
    setNotice(null);
    return true;
  }, [hotkeys, setNotice]);

  const handleHotkeyReset = useCallback(() => {
    const defaultHotkeys = getDefaultHotkeys();
    setHotkeys(defaultHotkeys);
    saveHotkeys(defaultHotkeys);
    setNotice(null);
  }, [setNotice]);

  return {
    showSettings,
    setShowSettings,
    showAbout,
    setShowAbout,
    autostartEnabled,
    hotkeys,
    handleToggleAutostart,
    handleHotkeyChange,
    handleHotkeyReset,
  };
}

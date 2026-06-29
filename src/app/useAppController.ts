import { useCallback, useEffect, useState, type RefObject } from "react";
import { listen } from "@tauri-apps/api/event";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { formatHotkeyFromEvent } from "../hotkeys";
import {
  mapAutostartError,
  mapHotkeyRegistrationError,
  mapHotkeyValidationError,
  type AppNotice,
} from "../errors";
import {
  loadHotkeys,
  normalizeHotkeyShortcut,
  saveHotkeys,
  validateHotkeys,
} from "../hotkeys";
import { useHotkeys } from "../hooks/useHotkeys";
import {
  loadSyncBrightnessEnabled,
  saveSyncBrightnessEnabled,
} from "../syncBrightness";
import {
  loadThemePreference,
  saveThemePreference,
} from "../themePreference";
import type { HotkeyConfig, HotkeyDirection, ThemePreference } from "../types";

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
  const [syncBrightnessEnabled, setSyncBrightnessEnabled] = useState(() =>
    loadSyncBrightnessEnabled()
  );
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    loadThemePreference()
  );
  const [hotkeys, setHotkeys] = useState<HotkeyConfig>(() => loadHotkeys());
  const [hotkeyRecording, setHotkeyRecording] = useState(false);
  const [hotkeyRecordingDirection, setHotkeyRecordingDirection] = useState<"increase" | "decrease" | null>(null);
  const [hotkeyError, setHotkeyError] = useState<string | null>(null);
  const [hotkeyErrorSeq, setHotkeyErrorSeq] = useState(0);

  useEffect(() => {
    if (!hotkeyRecording) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape" && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
        setHotkeyRecordingDirection(null);
        setHotkeyRecording(false);
        return;
      }

      const formatted = formatHotkeyFromEvent(event);
      if (!formatted || !hotkeyRecordingDirection) {
        return;
      }

      const direction = hotkeyRecordingDirection;
      const nextHotkeys = {
        ...hotkeys,
        [direction]: normalizeHotkeyShortcut(formatted),
      };

      const validationError = validateHotkeys(nextHotkeys);
      if (validationError) {
        setHotkeyErrorSeq((n) => n + 1);
        setHotkeyError(validationError);
        setHotkeyRecordingDirection(null);
        setHotkeyRecording(false);
        return;
      }

      setHotkeys(nextHotkeys);
      saveHotkeys(nextHotkeys);
      setHotkeyError(null);
      setHotkeyRecordingDirection(null);
      setHotkeyRecording(false);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [hotkeyRecording, hotkeyRecordingDirection, hotkeys, setNotice]);

  const handleStartHotkeyRecording = useCallback((direction: "increase" | "decrease") => {
    setHotkeyRecordingDirection(direction);
    setHotkeyRecording(true);
  }, []);

  const handleHotkeyRegistrationError = useCallback(() => {
    setNotice(mapHotkeyRegistrationError());
  }, [setNotice]);

  useHotkeys({
    currentPercentageRef,
    applyBrightness,
    hotkeys,
    disabled: hotkeyRecording,
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

  const handleToggleSyncBrightness = useCallback(() => {
    const nextValue = !syncBrightnessEnabled;
    setSyncBrightnessEnabled(nextValue);
    saveSyncBrightnessEnabled(nextValue);
    setNotice(null);
  }, [setNotice, syncBrightnessEnabled]);

  const handleThemePreferenceChange = useCallback((preference: ThemePreference) => {
    setThemePreference(preference);
    saveThemePreference(preference);
    setNotice(null);
  }, [setNotice]);

  return {
    showSettings,
    setShowSettings,
    showAbout,
    setShowAbout,
    autostartEnabled,
    syncBrightnessEnabled,
    themePreference,
    hotkeys,
    hotkeyRecordingDirection,
    handleStartHotkeyRecording,
    hotkeyError,
    hotkeyErrorSeq,
    handleToggleAutostart,
    handleToggleSyncBrightness,
    handleThemePreferenceChange,
    handleHotkeyChange,
  };
}

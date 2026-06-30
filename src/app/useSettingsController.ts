import { useCallback, useEffect, useState } from "react";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { mapAutostartError, type AppNotice } from "../errors";
import {
  loadSyncBrightnessEnabled,
  saveSyncBrightnessEnabled,
} from "../syncBrightness";
import {
  loadThemePreference,
  saveThemePreference,
} from "../themePreference";
import type { ThemePreference } from "../types";

type UseSettingsControllerOptions = {
  setNotice: (notice: AppNotice | null) => void;
};

export function useSettingsController({ setNotice }: UseSettingsControllerOptions) {
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [syncBrightnessEnabled, setSyncBrightnessEnabled] = useState(() =>
    loadSyncBrightnessEnabled()
  );
  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    loadThemePreference()
  );

  useEffect(() => {
    isEnabled().then(setAutostartEnabled).catch((err) => {
      console.warn("Failed to get autostart status:", err);
    });
  }, []);

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

  const handleToggleSyncBrightness = useCallback(() => {
    const nextValue = !syncBrightnessEnabled;
    setSyncBrightnessEnabled(nextValue);
    saveSyncBrightnessEnabled(nextValue);
    setNotice(null);
  }, [setNotice, syncBrightnessEnabled]);

  const handleThemePreferenceChange = useCallback(
    (preference: ThemePreference) => {
      setThemePreference(preference);
      saveThemePreference(preference);
      setNotice(null);
    },
    [setNotice]
  );

  return {
    autostartEnabled,
    syncBrightnessEnabled,
    themePreference,
    handleToggleAutostart,
    handleToggleSyncBrightness,
    handleThemePreferenceChange,
  };
}

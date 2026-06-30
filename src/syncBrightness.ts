const SYNC_BRIGHTNESS_SETTINGS_KEY = "brightbox-sync-brightness";

export function loadSyncBrightnessEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(SYNC_BRIGHTNESS_SETTINGS_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveSyncBrightnessEnabled(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SYNC_BRIGHTNESS_SETTINGS_KEY, String(enabled));
}

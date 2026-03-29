import type { HotkeyConfig } from "./types.ts";
import { HOTKEYS } from "./types.ts";

const HOTKEY_SETTINGS_KEY = "hdr-toolbox-hotkeys";

export function getDefaultHotkeys(): HotkeyConfig {
  return {
    increase: HOTKEYS.increase,
    decrease: HOTKEYS.decrease,
  };
}

export function loadHotkeys(): HotkeyConfig {
  if (typeof window === "undefined") {
    return getDefaultHotkeys();
  }

  try {
    const rawValue = window.localStorage.getItem(HOTKEY_SETTINGS_KEY);
    if (!rawValue) {
      return getDefaultHotkeys();
    }

    const parsed = JSON.parse(rawValue) as Partial<HotkeyConfig>;
    return {
      increase:
        typeof parsed.increase === "string" && parsed.increase.length > 0
          ? parsed.increase
          : HOTKEYS.increase,
      decrease:
        typeof parsed.decrease === "string" && parsed.decrease.length > 0
          ? parsed.decrease
          : HOTKEYS.decrease,
    };
  } catch {
    return getDefaultHotkeys();
  }
}

export function saveHotkeys(hotkeys: HotkeyConfig): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(HOTKEY_SETTINGS_KEY, JSON.stringify(hotkeys));
}

export function isModifierOnlyKey(key: string): boolean {
  return ["Control", "Alt", "Shift", "Meta"].includes(key);
}

export function formatHotkeyFromEvent(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "altKey" | "shiftKey" | "metaKey">): string | null {
  if (isModifierOnlyKey(event.key)) {
    return null;
  }

  const modifiers: string[] = [];
  if (event.ctrlKey) modifiers.push("Ctrl");
  if (event.altKey) modifiers.push("Alt");
  if (event.shiftKey) modifiers.push("Shift");
  if (event.metaKey) modifiers.push("Meta");

  const key = normalizeHotkeyKey(event.key);
  if (!key || modifiers.length === 0) {
    return null;
  }

  return [...modifiers, key].join("+");
}

export function normalizeHotkeyKey(key: string): string | null {
  if (!key) {
    return null;
  }

  const aliases: Record<string, string> = {
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    " ": "Space",
  };

  if (aliases[key]) {
    return aliases[key];
  }

  if (/^[a-z0-9]$/i.test(key)) {
    return key.toUpperCase();
  }

  if (/^F([1-9]|1[0-2])$/.test(key)) {
    return key.toUpperCase();
  }

  const namedKeys = ["Tab", "Enter", "Home", "End", "PageUp", "PageDown", "Insert", "Delete"];
  if (namedKeys.includes(key)) {
    return key;
  }

  return null;
}

export function validateHotkeys(hotkeys: HotkeyConfig): string | null {
  if (hotkeys.increase === hotkeys.decrease) {
    return "Brightness up and down shortcuts must be different.";
  }

  if (!hotkeys.increase || !hotkeys.decrease) {
    return "Both brightness shortcuts must be assigned.";
  }

  return null;
}

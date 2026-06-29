import { useEffect } from "react";
import type { RefObject } from "react";
import { register, unregister, type ShortcutEvent } from "@tauri-apps/plugin-global-shortcut";
import type { HotkeyConfig } from "../types";
import { HOTKEYS, SLIDER } from "../types";

type UseHotkeysOptions = {
  currentPercentageRef: RefObject<number>;
  applyBrightness: (percentage: number) => Promise<void>;
  hotkeys: HotkeyConfig;
  disabled?: boolean;
  onRegistrationError?: () => void;
};

export function useHotkeys({
  currentPercentageRef,
  applyBrightness,
  hotkeys,
  disabled = false,
  onRegistrationError,
}: UseHotkeysOptions) {
  useEffect(() => {
    if (disabled) {
      return;
    }
    let settled = false;
    const registered = { increase: false, decrease: false };
    const repeatTimers: ReturnType<typeof setInterval>[] = [];

    const adjustBrightnessByHotkey = async (delta: number) => {
      const nextPercentage = Math.max(
        SLIDER.MIN,
        Math.min(SLIDER.MAX, (currentPercentageRef.current ?? 0) + delta)
      );

      // applyBrightness already handles errors internally via setNotice
      await applyBrightness(nextPercentage);
    };

    const makeHotkeyHandler = (delta: number) => async (event: ShortcutEvent) => {
      if (settled) return;
      if (event.state === "Pressed") {
        await adjustBrightnessByHotkey(delta);
        const timer = setInterval(() => adjustBrightnessByHotkey(delta), 120);
        repeatTimers.push(timer);
      } else if (event.state === "Released") {
        while (repeatTimers.length > 0) {
          clearInterval(repeatTimers.pop());
        }
      }
    };

    const setupHotkeys = async () => {
      try {
        await register(hotkeys.increase, makeHotkeyHandler(HOTKEYS.STEP));
        if (settled) { unregister(hotkeys.increase).catch(() => {}); return; }
        registered.increase = true;

        await register(hotkeys.decrease, makeHotkeyHandler(-HOTKEYS.STEP));
        if (settled) { unregister(hotkeys.decrease).catch(() => {}); return; }
        registered.decrease = true;
      } catch (err) {
        console.warn("Failed to register hotkeys:", err);
        onRegistrationError?.();
      }
    };

    setupHotkeys();

    return () => {
      settled = true;
      while (repeatTimers.length > 0) {
        clearInterval(repeatTimers.pop());
      }
      if (registered.increase) unregister(hotkeys.increase).catch(() => {});
      if (registered.decrease) unregister(hotkeys.decrease).catch(() => {});
    };
  }, [disabled, applyBrightness, currentPercentageRef, hotkeys, onRegistrationError]);
}

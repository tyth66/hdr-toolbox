import { useEffect } from "react";
import type { RefObject } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import type { HotkeyConfig } from "../types";
import { HOTKEYS, SLIDER } from "../types";

type UseHotkeysOptions = {
  currentPercentageRef: RefObject<number>;
  applyBrightness: (percentage: number) => Promise<void>;
  hotkeys: HotkeyConfig;
  onRegistrationError?: () => void;
};

export function useHotkeys({
  currentPercentageRef,
  applyBrightness,
  hotkeys,
  onRegistrationError,
}: UseHotkeysOptions) {
  useEffect(() => {
    let settled = false;
    const registered = { increase: false, decrease: false };

    const adjustBrightnessByHotkey = async (delta: number) => {
      const nextPercentage = Math.max(
        SLIDER.MIN,
        Math.min(SLIDER.MAX, (currentPercentageRef.current ?? 0) + delta)
      );

      try {
        await applyBrightness(nextPercentage);
      } catch {
      }
    };

    const setupHotkeys = async () => {
      try {
        await register(hotkeys.increase, async () => {
          if (settled) return;
          await adjustBrightnessByHotkey(HOTKEYS.STEP);
        });
        if (settled) {
          unregister(hotkeys.increase).catch(() => {});
          return;
        }
        registered.increase = true;

        await register(hotkeys.decrease, async () => {
          if (settled) return;
          await adjustBrightnessByHotkey(-HOTKEYS.STEP);
        });
        if (settled) {
          unregister(hotkeys.decrease).catch(() => {});
          return;
        }
        registered.decrease = true;
      } catch (err) {
        console.warn("Failed to register hotkeys:", err);
        onRegistrationError?.();
      }
    };

    setupHotkeys();

    return () => {
      settled = true;
      if (registered.increase) unregister(hotkeys.increase).catch(() => {});
      if (registered.decrease) unregister(hotkeys.decrease).catch(() => {});
    };
  }, [applyBrightness, currentPercentageRef, hotkeys, onRegistrationError]);
}

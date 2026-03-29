import { useEffect } from "react";
import type { RefObject } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";
import { HOTKEYS, SLIDER } from "../types";

type UseHotkeysOptions = {
  currentPercentageRef: RefObject<number>;
  applyBrightness: (percentage: number) => Promise<void>;
};

export function useHotkeys({
  currentPercentageRef,
  applyBrightness,
}: UseHotkeysOptions) {
  useEffect(() => {
    let settled = false;
    const registered = { up: false, down: false };

    const adjustBrightnessByHotkey = async (delta: number) => {
      const nextPercentage = Math.max(
        SLIDER.MIN,
        Math.min(SLIDER.MAX, (currentPercentageRef.current ?? 0) + delta)
      );

      try {
        await applyBrightness(nextPercentage);
      } catch (err) {
        console.error("Failed to set brightness:", err);
      }
    };

    const setupHotkeys = async () => {
      try {
        await register(HOTKEYS.INCREASE, async () => {
          if (settled) return;
          await adjustBrightnessByHotkey(HOTKEYS.STEP);
        });
        if (settled) {
          unregister(HOTKEYS.INCREASE).catch(() => {});
          return;
        }
        registered.up = true;

        await register(HOTKEYS.DECREASE, async () => {
          if (settled) return;
          await adjustBrightnessByHotkey(-HOTKEYS.STEP);
        });
        if (settled) {
          unregister(HOTKEYS.DECREASE).catch(() => {});
          return;
        }
        registered.down = true;
      } catch (err) {
        console.warn("Failed to register hotkeys:", err);
      }
    };

    setupHotkeys();

    return () => {
      settled = true;
      if (registered.up) unregister(HOTKEYS.INCREASE).catch(() => {});
      if (registered.down) unregister(HOTKEYS.DECREASE).catch(() => {});
    };
  }, [applyBrightness, currentPercentageRef]);
}

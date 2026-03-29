import { invoke } from "@tauri-apps/api/core";
import type { DisplayInfo } from "../types";

export async function getHdrDisplays(): Promise<DisplayInfo[]> {
  return invoke<DisplayInfo[]>("get_hdr_displays");
}

export async function setBrightness(
  adapterLow: number,
  adapterHigh: number,
  targetId: number,
  percentage: number,
  minNits: number,
  maxNits: number
): Promise<void> {
  return invoke("set_brightness", {
    adapterLow,
    adapterHigh,
    targetId,
    percentage,
    minNits,
    maxNits,
  });
}

export async function setBrightnessAll(
  displays: DisplayInfo[],
  percentage: number
): Promise<void> {
  return invoke("set_brightness_all", { displays, percentage });
}

export async function updateDisplaysAndTooltip(
  displays: DisplayInfo[]
): Promise<void> {
  return invoke("update_displays_and_tooltip", { displays });
}

export async function updateTrayTooltipOnly(): Promise<void> {
  return invoke("update_tray_tooltip_only");
}

export async function getTrayRect(): Promise<{
  x: number;
  y: number;
  width: number;
  height: number;
} | null> {
  return invoke("get_tray_rect");
}

export async function setStartupInfoMode(active: boolean): Promise<void> {
  return invoke("set_startup_info_mode", { active });
}

export async function setDraggingMode(active: boolean): Promise<void> {
  return invoke("set_dragging_mode", { active });
}

export async function quit(): Promise<void> {
  return invoke("quit");
}

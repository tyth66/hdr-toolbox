import { invoke } from "@tauri-apps/api/core";
import type { DisplayInfo } from "../types";
import type { StructuredDisplayError } from "../errors";

export type BrightnessAllFailure = {
  adapter_id_low: number;
  adapter_id_high: number;
  target_id: number;
  name: string;
  error: StructuredDisplayError;
};

export type BrightnessAllOutcome = {
  displays: DisplayInfo[];
  failures: BrightnessAllFailure[];
};

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
): Promise<DisplayInfo[]> {
  return invoke<DisplayInfo[]>("set_brightness", {
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
): Promise<BrightnessAllOutcome> {
  return invoke<BrightnessAllOutcome>("set_brightness_all", { displays, percentage });
}

export async function setHdrEnabled(
  adapterLow: number,
  adapterHigh: number,
  targetId: number,
  enabled: boolean
): Promise<DisplayInfo[]> {
  return invoke<DisplayInfo[]>("set_hdr_enabled", {
    adapterLow,
    adapterHigh,
    targetId,
    enabled,
  });
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

export async function getSystemAccentColor(): Promise<string> {
  return invoke<string>("get_system_accent_color");
}

export async function quit(): Promise<void> {
  return invoke("quit");
}

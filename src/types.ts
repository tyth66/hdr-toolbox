/**
 * Shared type definitions for HDR Toolbox
 */

// Note: DisplayInfo must match the Rust struct exactly
// Any changes to the Rust struct must be reflected here
export interface DisplayInfo {
  name: string;
  nits: number;
  min_percentage: number;
  max_percentage: number;
  hdr_enabled: boolean;
  adapter_id_low: number;
  adapter_id_high: number;
  target_id: number;
  min_nits?: number;
  max_nits?: number;
}

export type HotkeyDirection = "increase" | "decrease";

export interface HotkeyConfig {
  increase: string;
  decrease: string;
}

// Constants shared across the app
export const LUMINANCE = {
  MIN_NITS: 80,
  MAX_NITS: 480,
  DEFAULT_MIN_NITS: 80,
  DEFAULT_MAX_NITS: 480,
} as const;

export const WINDOW_CONFIG = {
  WIDTH: 300,
  HEIGHT: 200,
  POSITION_KEY: "hdr-toolbox-window-position",
} as const;

export const HOTKEYS: HotkeyConfig & { STEP: number } = {
  increase: "Ctrl+Alt+Up",
  decrease: "Ctrl+Alt+Down",
  STEP: 10, // percentage points per hotkey press
} as const;

export const SLIDER = {
  MIN: 0,
  MAX: 100,
  WHEEL_STEP: 5,
} as const;

/**
 * Convert nits to percentage (0-100) using standard nits range
 */
export function nitsToPercentage(nits: number): number {
  const range = LUMINANCE.DEFAULT_MAX_NITS - LUMINANCE.DEFAULT_MIN_NITS;
  if (range === 0) return 0;
  return Math.round(((nits - LUMINANCE.DEFAULT_MIN_NITS) / range) * 100);
}

/**
 * Convert percentage (0-100) to nits using standard nits range
 */
export function percentageToNits(percentage: number): number {
  const range = LUMINANCE.DEFAULT_MAX_NITS - LUMINANCE.DEFAULT_MIN_NITS;
  return Math.round(((percentage / 100) * range) + LUMINANCE.DEFAULT_MIN_NITS);
}

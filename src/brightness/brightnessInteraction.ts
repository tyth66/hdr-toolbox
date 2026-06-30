import { SLIDER } from "../types";

export function getWheelBrightnessPercentage(
  currentPercentage: number,
  deltaY: number
): number {
  const direction = deltaY > 0 ? -1 : 1;
  return Math.max(
    SLIDER.MIN,
    Math.min(SLIDER.MAX, currentPercentage + direction * SLIDER.WHEEL_STEP)
  );
}

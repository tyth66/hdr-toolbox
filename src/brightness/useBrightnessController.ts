import { useCallback, useEffect, useRef, type RefObject, type WheelEvent } from "react";
import { getWheelBrightnessPercentage } from "./brightnessInteraction";

type UseBrightnessControllerOptions = {
  canAdjustBrightness: boolean;
  currentPercentageRef: RefObject<number>;
  previewPercentage: (percentage: number) => void;
  applyBrightness: (percentage: number) => Promise<void>;
};

export function useBrightnessController({
  canAdjustBrightness,
  currentPercentageRef,
  previewPercentage,
  applyBrightness,
}: UseBrightnessControllerOptions) {
  const isDraggingRef = useRef(false);
  const sliderDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSliderDebounce = useCallback(() => {
    if (sliderDebounceRef.current !== null) {
      clearTimeout(sliderDebounceRef.current);
      sliderDebounceRef.current = null;
    }
  }, []);

  const clearWheelDebounce = useCallback(() => {
    if (wheelDebounceRef.current !== null) {
      clearTimeout(wheelDebounceRef.current);
      wheelDebounceRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearSliderDebounce();
      clearWheelDebounce();
    };
  }, [clearSliderDebounce, clearWheelDebounce]);

  const handleSliderChange = useCallback((percentage: number, element: HTMLInputElement) => {
    if (!canAdjustBrightness) {
      return;
    }

    previewPercentage(percentage);
    element.style.setProperty("--progress", `${percentage}%`);

    clearSliderDebounce();
    sliderDebounceRef.current = setTimeout(async () => {
      try {
        await applyBrightness(percentage);
      } catch {
      } finally {
        sliderDebounceRef.current = null;
      }
    }, 50);
  }, [applyBrightness, canAdjustBrightness, clearSliderDebounce, previewPercentage]);

  const handleSliderDown = useCallback(() => {
    if (!canAdjustBrightness) {
      return;
    }

    clearSliderDebounce();
    isDraggingRef.current = true;
  }, [canAdjustBrightness, clearSliderDebounce]);

  const handleSliderCommit = useCallback(async (percentage: number) => {
    if (!canAdjustBrightness) {
      return;
    }

    isDraggingRef.current = false;
    clearSliderDebounce();

    try {
      await applyBrightness(percentage);
    } catch {
    }
  }, [applyBrightness, canAdjustBrightness, clearSliderDebounce]);

  const handleSliderWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (!canAdjustBrightness) {
      return;
    }

    event.preventDefault();

    const currentPercentage = currentPercentageRef.current ?? 0;
    const nextPercentage = getWheelBrightnessPercentage(
      currentPercentage,
      event.deltaY
    );

    if (nextPercentage === currentPercentage) {
      return;
    }

    previewPercentage(nextPercentage);
    clearWheelDebounce();

    wheelDebounceRef.current = setTimeout(async () => {
      try {
        await applyBrightness(nextPercentage);
      } catch {
      } finally {
        wheelDebounceRef.current = null;
      }
    }, 60);
  }, [
    applyBrightness,
    canAdjustBrightness,
    clearWheelDebounce,
    currentPercentageRef,
    previewPercentage,
  ]);

  return {
    handleSliderChange,
    handleSliderDown,
    handleSliderCommit,
    handleSliderWheel,
  };
}

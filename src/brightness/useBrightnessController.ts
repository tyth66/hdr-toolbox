import { useCallback, useEffect, useRef, type RefObject, type WheelEvent } from "react";
import { SLIDER } from "../types";

type UseBrightnessControllerOptions = {
  hdrActive: boolean;
  isHdrPending: boolean;
  currentPercentageRef: RefObject<number>;
  previewPercentage: (percentage: number) => void;
  applyBrightness: (percentage: number) => Promise<void>;
};

export function useBrightnessController({
  hdrActive,
  isHdrPending,
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
    if (!hdrActive || isHdrPending) {
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
  }, [applyBrightness, clearSliderDebounce, hdrActive, isHdrPending, previewPercentage]);

  const handleSliderDown = useCallback(() => {
    if (!hdrActive || isHdrPending) {
      return;
    }

    clearSliderDebounce();
    isDraggingRef.current = true;
  }, [clearSliderDebounce, hdrActive, isHdrPending]);

  const handleSliderCommit = useCallback(async (percentage: number) => {
    if (!hdrActive || isHdrPending) {
      return;
    }

    isDraggingRef.current = false;
    clearSliderDebounce();

    try {
      await applyBrightness(percentage);
    } catch {
    }
  }, [applyBrightness, clearSliderDebounce, hdrActive, isHdrPending]);

  const handleSliderWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (!hdrActive || isHdrPending) {
      return;
    }

    event.preventDefault();

    const direction = event.deltaY > 0 ? -1 : 1;
    const currentPercentage = currentPercentageRef.current ?? 0;
    const nextPercentage = Math.max(
      SLIDER.MIN,
      Math.min(
        SLIDER.MAX,
        currentPercentage + (direction * SLIDER.WHEEL_STEP)
      )
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
    clearWheelDebounce,
    currentPercentageRef,
    hdrActive,
    isHdrPending,
    previewPercentage,
  ]);

  return {
    handleSliderChange,
    handleSliderDown,
    handleSliderCommit,
    handleSliderWheel,
  };
}

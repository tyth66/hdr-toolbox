import { useCallback, useEffect, useState, type RefObject } from "react";
import {
  mapHotkeyRegistrationError,
  mapHotkeyValidationError,
  type AppNotice,
} from "../errors";
import {
  formatHotkeyFromEvent,
  loadHotkeys,
  normalizeHotkeyShortcut,
  saveHotkeys,
  validateHotkeys,
} from "../hotkeys";
import { useHotkeys } from "../hooks/useHotkeys";
import type { HotkeyConfig, HotkeyDirection } from "../types";

type UseHotkeyControllerOptions = {
  currentPercentageRef: RefObject<number>;
  applyBrightness: (percentage: number) => Promise<void>;
  setNotice: (notice: AppNotice | null) => void;
};

export function useHotkeyController({
  currentPercentageRef,
  applyBrightness,
  setNotice,
}: UseHotkeyControllerOptions) {
  const [hotkeys, setHotkeys] = useState<HotkeyConfig>(() => loadHotkeys());
  const [hotkeyRecording, setHotkeyRecording] = useState(false);
  const [hotkeyRecordingDirection, setHotkeyRecordingDirection] = useState<
    "increase" | "decrease" | null
  >(null);
  const [hotkeyError, setHotkeyError] = useState<string | null>(null);
  const [hotkeyErrorSeq, setHotkeyErrorSeq] = useState(0);

  useEffect(() => {
    if (!hotkeyRecording) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (
        event.key === "Escape" &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        !event.metaKey
      ) {
        setHotkeyRecordingDirection(null);
        setHotkeyRecording(false);
        return;
      }

      const formatted = formatHotkeyFromEvent(event);
      if (!formatted || !hotkeyRecordingDirection) {
        return;
      }

      const direction = hotkeyRecordingDirection;
      const nextHotkeys = {
        ...hotkeys,
        [direction]: normalizeHotkeyShortcut(formatted),
      };

      const validationError = validateHotkeys(nextHotkeys);
      if (validationError) {
        setHotkeyErrorSeq((n) => n + 1);
        setHotkeyError(validationError);
        setHotkeyRecordingDirection(null);
        setHotkeyRecording(false);
        return;
      }

      setHotkeys(nextHotkeys);
      saveHotkeys(nextHotkeys);
      setHotkeyError(null);
      setHotkeyRecordingDirection(null);
      setHotkeyRecording(false);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [hotkeyRecording, hotkeyRecordingDirection, hotkeys]);

  const handleStartHotkeyRecording = useCallback(
    (direction: "increase" | "decrease") => {
      setHotkeyRecordingDirection(direction);
      setHotkeyRecording(true);
    },
    []
  );

  const handleHotkeyRegistrationError = useCallback(() => {
    setNotice(mapHotkeyRegistrationError());
  }, [setNotice]);

  useHotkeys({
    currentPercentageRef,
    applyBrightness,
    hotkeys,
    disabled: hotkeyRecording,
    onRegistrationError: handleHotkeyRegistrationError,
  });

  const handleHotkeyChange = useCallback(
    (direction: HotkeyDirection, value: string) => {
      const nextHotkeys = {
        ...hotkeys,
        [direction]: normalizeHotkeyShortcut(value),
      };

      const validationError = validateHotkeys(nextHotkeys);
      if (validationError) {
        setNotice(mapHotkeyValidationError(validationError));
        return false;
      }

      setHotkeys(nextHotkeys);
      saveHotkeys(nextHotkeys);
      setNotice(null);
      return true;
    },
    [hotkeys, setNotice]
  );

  return {
    hotkeys,
    hotkeyRecordingDirection,
    handleStartHotkeyRecording,
    hotkeyError,
    hotkeyErrorSeq,
    handleHotkeyChange,
  };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { setStartupInfoMode } from "../services/tauriApi";

const DEFAULT_DURATION_MS = 4000;

export function useStartupOverlay(durationMs = DEFAULT_DURATION_MS) {
  const [showStartupInfo, setShowStartupInfo] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOverlayTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const closeStartupOverlay = useCallback(() => {
    clearOverlayTimer();
    setShowStartupInfo(false);
  }, [clearOverlayTimer]);

  const startStartupOverlay = useCallback(async () => {
    clearOverlayTimer();
    await setStartupInfoMode(true);
    setShowStartupInfo(true);
    timerRef.current = setTimeout(() => {
      setShowStartupInfo(false);
      timerRef.current = null;
    }, durationMs);
  }, [clearOverlayTimer, durationMs]);

  useEffect(() => {
    setStartupInfoMode(showStartupInfo).catch(() => {});
  }, [showStartupInfo]);

  useEffect(() => clearOverlayTimer, [clearOverlayTimer]);

  return {
    showStartupInfo,
    startStartupOverlay,
    closeStartupOverlay,
  };
}

import { useCallback, useEffect, useState } from "react";
import { getSystemAccentColor } from "../services/tauriApi";

const FALLBACK_ACCENT_COLOR = "#0078d4";

/**
 * Reads the Windows system accent color on mount and injects it into CSS
 * custom properties. Falls back to #0078d4 if the Rust command fails.
 */
export function useAccentColor() {
  const [accentColor, setAccentColor] = useState(FALLBACK_ACCENT_COLOR);

  const refreshAccentColor = useCallback(async () => {
    try {
      const color = await getSystemAccentColor();
      setAccentColor(color);
      applyAccentColor(color);
      return color;
    } catch {
      setAccentColor(FALLBACK_ACCENT_COLOR);
      applyAccentColor(FALLBACK_ACCENT_COLOR);
      return FALLBACK_ACCENT_COLOR;
    }
  }, []);

  useEffect(() => {
    refreshAccentColor();
  }, [refreshAccentColor]);

  return { accentColor, refreshAccentColor };
}

function applyAccentColor(color: string) {
  document.documentElement.style.setProperty("--color-accent", color);
  document.documentElement.style.setProperty("--color-accent-hover", color);
  document.documentElement.style.setProperty("--color-accent-active", color);
  document.documentElement.style.setProperty("--win-blue", color);
  document.documentElement.style.setProperty("--accent", color);
  document.documentElement.style.setProperty("--accent-dim", color);
}

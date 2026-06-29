import { useCallback, useEffect, useState } from "react";

const FIXED_CODEX_ACCENT_COLOR = "#339CFF";

/**
 * Injects the fixed Codex accent into CSS custom properties.
 */
export function useAccentColor() {
  const [accentColor, setAccentColor] = useState(FIXED_CODEX_ACCENT_COLOR);

  const refreshAccentColor = useCallback(async () => {
    setAccentColor(FIXED_CODEX_ACCENT_COLOR);
    applyAccentColor(FIXED_CODEX_ACCENT_COLOR);
    return FIXED_CODEX_ACCENT_COLOR;
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

import { useState } from "react";

export function useDialogController() {
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  return {
    showSettings,
    setShowSettings,
    showAbout,
    setShowAbout,
  };
}

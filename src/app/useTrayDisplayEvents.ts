import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

type UseTrayDisplayEventsOptions = {
  loadDisplays: () => Promise<void>;
  refreshKnownDisplayState: (options?: { initial?: boolean; silent?: boolean }) => Promise<void>;
  selectDisplay: (idx: number) => void;
  showWindow: () => Promise<void>;
};

export function useTrayDisplayEvents({
  loadDisplays,
  refreshKnownDisplayState,
  selectDisplay,
  showWindow,
}: UseTrayDisplayEventsOptions) {
  useEffect(() => {
    loadDisplays();

    const unlistenShowWindow = listen("show-window", async () => {
      await showWindow();
      await refreshKnownDisplayState({ silent: true });
    });

    const unlistenSelectDisplay = listen<number>("select-display", (event) => {
      selectDisplay(event.payload);
    });

    return () => {
      unlistenShowWindow.then((fn) => fn());
      unlistenSelectDisplay.then((fn) => fn());
    };
  }, [loadDisplays, refreshKnownDisplayState, selectDisplay, showWindow]);
}

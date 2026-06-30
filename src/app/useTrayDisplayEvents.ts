import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

type UseTrayDisplayEventsOptions = {
  loadDisplays: () => Promise<void>;
  refreshDisplays: (options?: { initial?: boolean; silent?: boolean }) => Promise<void>;
  selectDisplay: (idx: number) => void;
  showWindow: () => Promise<void>;
};

export function useTrayDisplayEvents({
  loadDisplays,
  refreshDisplays,
  selectDisplay,
  showWindow,
}: UseTrayDisplayEventsOptions) {
  useEffect(() => {
    loadDisplays();

    const unlistenShowWindow = listen("show-window", async () => {
      await showWindow();
      await refreshDisplays({ silent: true });
    });

    const unlistenSelectDisplay = listen<number>("select-display", (event) => {
      selectDisplay(event.payload);
    });

    return () => {
      unlistenShowWindow.then((fn) => fn());
      unlistenSelectDisplay.then((fn) => fn());
    };
  }, [loadDisplays, refreshDisplays, selectDisplay, showWindow]);
}

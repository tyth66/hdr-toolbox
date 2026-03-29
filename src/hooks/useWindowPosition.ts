import { useCallback, useEffect } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";
import { getTrayRect, setDraggingMode } from "../services/tauriApi";
import { WINDOW_CONFIG } from "../types";

export function useWindowPosition() {
  const positionWindow = useCallback(async () => {
    const win = getCurrentWindow();
    const savedPos = localStorage.getItem(WINDOW_CONFIG.POSITION_KEY);

    if (savedPos) {
      try {
        const { x, y } = JSON.parse(savedPos);
        await win.setPosition(new PhysicalPosition(x, y));
        return;
      } catch {
        localStorage.removeItem(WINDOW_CONFIG.POSITION_KEY);
      }
    }

    try {
      const trayRect = await getTrayRect();
      if (trayRect) {
        const x = Math.round(
          trayRect.x + (trayRect.width - WINDOW_CONFIG.WIDTH) / 2
        );
        const y = Math.round(trayRect.y - WINDOW_CONFIG.HEIGHT - 10);
        await win.setPosition(new PhysicalPosition(x, y));
        return;
      }
    } catch {
      // Ignore tray positioning failures and fall through to center.
    }

    await win.center();
  }, []);

  const showWindow = useCallback(async () => {
    try {
      const win = getCurrentWindow();
      await positionWindow();
      await win.show();
      await win.setFocus();
    } catch {
      // Ignore transient window lifecycle errors.
    }
  }, [positionWindow]);

  const hideWindow = useCallback(() => {
    getCurrentWindow().hide();
  }, []);

  const handleTitleBarMouseDown = useCallback(
    async (event: ReactMouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest("button")) {
        return;
      }

      event.preventDefault();

      try {
        await setDraggingMode(true);
        await getCurrentWindow().startDragging();
        setTimeout(() => {
          setDraggingMode(false).catch(() => {});
        }, 200);
      } catch {
        setDraggingMode(false).catch(() => {});
      }
    },
    []
  );

  useEffect(() => {
    let unlistenMove: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const win = getCurrentWindow();
        unlistenMove = await win.onMoved(async () => {
          try {
            const pos = await win.outerPosition();
            localStorage.setItem(
              WINDOW_CONFIG.POSITION_KEY,
              JSON.stringify({ x: pos.x, y: pos.y })
            );
          } catch {
            // Ignore position persistence failures.
          }
        });
      } catch {
        // Ignore listener setup failures.
      }
    };

    setupListener();

    return () => {
      if (unlistenMove) {
        unlistenMove();
      }
    };
  }, []);

  return {
    showWindow,
    hideWindow,
    handleTitleBarMouseDown,
  };
}

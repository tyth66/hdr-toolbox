import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { AppNotice } from "../errors";

const DEFAULT_NOTICE_AUTO_DISMISS_MS = 5000;

type UseNoticeControllerOptions = {
  notice: AppNotice | null;
  setNotice: Dispatch<SetStateAction<AppNotice | null>>;
  autoDismissMs?: number;
};

export function useNoticeController({
  notice,
  setNotice,
  autoDismissMs = DEFAULT_NOTICE_AUTO_DISMISS_MS,
}: UseNoticeControllerOptions) {
  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setNotice(null);
    }, autoDismissMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [autoDismissMs, notice, setNotice]);
}

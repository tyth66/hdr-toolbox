import { useCallback, useMemo, useState } from "react";
import {
  mapBrightnessError,
  mapHdrToggleError,
  mapInitialLoadError,
  mapRefreshError,
  type AppNotice,
} from "../errors";

type RefreshOptions = {
  initial: boolean;
  silent?: boolean;
};

export type DisplayFeedbackController = {
  beginRefresh: (options: RefreshOptions) => void;
  finishRefresh: (options: RefreshOptions) => void;
  clearNotice: () => void;
  setNotice: (notice: AppNotice | null) => void;
  reportInitialLoadError: (err: unknown) => void;
  reportRefreshError: (err: unknown, silent?: boolean) => void;
  reportBrightnessError: () => void;
  reportHdrToggleError: () => void;
  setHdrPending: (active: boolean) => void;
};

export function useDisplayFeedbackState() {
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHdrPending, setIsHdrPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<AppNotice | null>(null);

  const beginRefresh = useCallback(({ initial }: RefreshOptions) => {
    if (initial) {
      setLoading(true);
      setError(null);
      setNotice(null);
      return;
    }

    setIsRefreshing(true);
  }, []);

  const finishRefresh = useCallback(({ initial }: RefreshOptions) => {
    if (initial) {
      setLoading(false);
      return;
    }

    setIsRefreshing(false);
  }, []);

  const clearNotice = useCallback(() => {
    setNotice(null);
  }, []);

  const reportInitialLoadError = useCallback((err: unknown) => {
    setError(mapInitialLoadError(err));
  }, []);

  const reportRefreshError = useCallback((err: unknown, silent?: boolean) => {
    setNotice(mapRefreshError(err, silent));
  }, []);

  const reportBrightnessError = useCallback(() => {
    setNotice(mapBrightnessError());
  }, []);

  const reportHdrToggleError = useCallback(() => {
    setNotice(mapHdrToggleError());
  }, []);

  const feedback = useMemo<DisplayFeedbackController>(
    () => ({
      beginRefresh,
      finishRefresh,
      clearNotice,
      setNotice,
      reportInitialLoadError,
      reportRefreshError,
      reportBrightnessError,
      reportHdrToggleError,
      setHdrPending: setIsHdrPending,
    }),
    [
      beginRefresh,
      clearNotice,
      finishRefresh,
      reportBrightnessError,
      reportHdrToggleError,
      reportInitialLoadError,
      reportRefreshError,
    ]
  );

  return {
    loading,
    isRefreshing,
    isHdrPending,
    error,
    notice,
    setNotice,
    feedback,
  };
}

import { memo } from "react";
import { TitleBar } from "./TitleBar";

type AppShellSurfaceProps = {
  windowClassName: string;
  onClose: () => void;
};

export const LoadingSurface = memo(function LoadingSurface({
  windowClassName,
  onClose,
}: AppShellSurfaceProps) {
  return (
    <div className={windowClassName}>
      <TitleBar minimal onClose={onClose} />
      <div className="app-state app-state-loading">
        <span>Looking for HDR-capable displays...</span>
      </div>
    </div>
  );
});

type ErrorSurfaceProps = AppShellSurfaceProps & {
  error: string;
};

export const ErrorSurface = memo(function ErrorSurface({
  windowClassName,
  onClose,
  error,
}: ErrorSurfaceProps) {
  return (
    <div className={windowClassName}>
      <TitleBar minimal onClose={onClose} />
      <div className="app-state app-state-error">
        <div className="state-message">{error}</div>
      </div>
    </div>
  );
});

export const EmptySurface = memo(function EmptySurface({
  windowClassName,
  onClose,
}: AppShellSurfaceProps) {
  return (
    <div className={windowClassName}>
      <TitleBar minimal onClose={onClose} />
      <div className="app-state app-state-empty">
        <div className="state-message">
          No HDR-capable displays found.
          <br />
          Check your display connection or Windows display settings.
        </div>
      </div>
    </div>
  );
});

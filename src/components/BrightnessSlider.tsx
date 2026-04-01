import { memo, type WheelEventHandler } from "react";
import { SLIDER } from "../types";

type BrightnessSliderProps = {
  value: number;
  disabled?: boolean;
  onChange: (value: number, element: HTMLInputElement) => void;
  onPointerDown: () => void;
  onCommit: (value: number) => Promise<void>;
  onWheelAdjust: WheelEventHandler<HTMLDivElement>;
};

export const BrightnessSlider = memo(function BrightnessSlider({
  value,
  disabled = false,
  onChange,
  onPointerDown,
  onCommit,
  onWheelAdjust,
}: BrightnessSliderProps) {
  return (
    <div className="slider-section">
      <div className="slider-header">
        <span className="slider-label">SDR Brightness</span>
        <div className="slider-value">
          <span className="nits-value">{value}</span>
          <span className="nits-unit">%</span>
        </div>
      </div>

      {disabled ? (
        <div className="slider-helper">Turn HDR on to adjust SDR brightness</div>
      ) : null}

      <div className="slider-wrapper" onWheel={onWheelAdjust}>
        <div className="slider-fill" style={{ width: `${value}%` }} />
        <input
          type="range"
          min={SLIDER.MIN}
          max={SLIDER.MAX}
          step={1}
          value={value}
          onChange={(event) => onChange(parseInt(event.target.value, 10), event.target)}
          onMouseDown={onPointerDown}
          onMouseUp={(event) => onCommit(parseInt(event.currentTarget.value, 10))}
          onTouchStart={onPointerDown}
          onTouchEnd={(event) => onCommit(parseInt(event.currentTarget.value, 10))}
          className={`brightness-slider ${disabled ? "disabled" : ""}`}
          disabled={disabled}
          aria-label="SDR Brightness"
          aria-valuemin={SLIDER.MIN}
          aria-valuemax={SLIDER.MAX}
          aria-valuenow={value}
        />
      </div>

      <div className="slider-range">
        <span>{SLIDER.MIN}</span>
        <span>{SLIDER.MAX}%</span>
      </div>
    </div>
  );
});

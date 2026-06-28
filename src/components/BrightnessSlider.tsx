import { memo, type WheelEventHandler } from "react";
import { Slider, type SliderOnChangeData } from "@fluentui/react-components";
import { SLIDER } from "../types";

type BrightnessSliderProps = {
  value: number;
  displayName: string;
  disabled?: boolean;
  onChange: (value: number, element: HTMLInputElement) => void;
  onPointerDown: () => void;
  onCommit: (value: number) => Promise<void>;
  onWheelAdjust: WheelEventHandler<HTMLDivElement>;
};

export const BrightnessSlider = memo(function BrightnessSlider({
  value,
  displayName,
  disabled = false,
  onChange,
  onPointerDown,
  onCommit,
  onWheelAdjust,
}: BrightnessSliderProps) {
  return (
    <div className="slider-section" onWheel={onWheelAdjust}>
      <div className="display-name" title={displayName}>
        {displayName}
      </div>
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

      <Slider
        className="brightness-slider-control"
        min={SLIDER.MIN}
        max={SLIDER.MAX}
        step={1}
        value={value}
        disabled={disabled}
        size="small"
        onChange={(_ev: React.ChangeEvent<HTMLInputElement>, data: SliderOnChangeData) => {
          onChange(data.value, _ev.target);
        }}
        onMouseDown={onPointerDown}
        onMouseUp={(_ev: React.MouseEvent<HTMLInputElement>) => {
          onCommit(Number(_ev.currentTarget.value));
        }}
        onTouchStart={onPointerDown}
        onTouchEnd={(_ev: React.TouchEvent<HTMLInputElement>) => {
          onCommit(Number(_ev.currentTarget.value));
        }}
        aria-label="SDR Brightness"
        aria-valuemin={SLIDER.MIN}
        aria-valuemax={SLIDER.MAX}
        aria-valuenow={value}
      />

      <div className="slider-range">
        <span>{SLIDER.MIN}</span>
        <span>{SLIDER.MAX}%</span>
      </div>
    </div>
  );
});

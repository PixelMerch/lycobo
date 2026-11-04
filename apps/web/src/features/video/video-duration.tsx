import { Label, Slider } from "@heroui/react";
import { useState } from "react";

const ticks = Array.from({ length: 51 }, (_, index) => index);
export function VideoDuration({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  return (
    <Slider
      className="video-duration-slider"
      minValue={5}
      maxValue={30}
      step={1}
      value={value}
      isDisabled={disabled}
      onChange={(next) => onChange(Number(next))}
      aria-label="视频时长"
    >
      <Label>时长</Label>
      <div className="video-duration-row">
        <span className="video-duration-endpoint">5s</span>
        <Slider.Track
          className="video-duration-track"
          onPointerMove={(event) => {
            if (disabled || event.pointerType === "touch") return;
            const track = event.currentTarget;
            const x = event.clientX - track.getBoundingClientRect().left - track.clientLeft;
            setHover(Math.max(0, Math.min(1, x / track.clientWidth)));
          }}
          onPointerLeave={() => setHover(null)}
          onPointerCancel={() => setHover(null)}
        >
          {({ state }) => {
            const dragging = state.isThumbDragging(0);
            const preview = dragging ? null : hover;
            const position = preview ?? state.getThumbPercent(0);
            const seconds = preview === null ? value : Math.round(5 + preview * 25);
            const showPreview = !disabled && (hover !== null || focused || dragging);
            return (
              <>
                <span className="video-duration-wave" aria-hidden="true">
                  {ticks.map((tick) => {
                    const distance = Math.abs(tick / 50 - position);
                    const wave = showPreview ? Math.max(0, 1 - distance / 0.09) : 0;
                    return (
                      <span
                        key={tick}
                        style={{ height: `${(tick % 5 === 0 ? 8 : 4) + wave * 6}px` }}
                      />
                    );
                  })}
                </span>
                {showPreview && (
                  <span
                    className="video-duration-preview"
                    style={{ left: `${position * 100}%` }}
                    aria-hidden="true"
                  >
                    {seconds}秒
                  </span>
                )}
                <Slider.Fill />
                <Slider.Thumb
                  aria-label={`视频时长：${value}秒`}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                />
              </>
            );
          }}
        </Slider.Track>
        <span className="video-duration-endpoint">30s</span>
        <Slider.Output className="video-duration-current">{value} 秒</Slider.Output>
      </div>
    </Slider>
  );
}

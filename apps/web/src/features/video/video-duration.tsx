import { Label, Slider, Tooltip } from "@heroui/react";
import { useRef, useState } from "react";

const ticks = Array.from({ length: 51 }, (_, index) => index);
export function VideoDuration({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const position = hover ?? (value - 5) / 25;
  const seconds = hover === null ? value : Math.round(5 + hover * 25);
  return (
    <Slider
      className="video-duration-slider"
      minValue={5}
      maxValue={30}
      step={1}
      value={value}
      onChange={(next) => onChange(Number(next))}
      aria-label="视频时长"
    >
      <Label>时长</Label>
      <div className="video-duration-row">
        <Tooltip isOpen={hover !== null || focused} delay={0}>
          <Slider.Track
            className="video-duration-track"
            onPointerMove={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              setHover(Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)));
            }}
            onPointerLeave={() => setHover(null)}
            onPointerCancel={() => setHover(null)}
          >
            <span className="video-duration-wave" aria-hidden="true">
              {ticks.map((tick) => {
                const distance = Math.abs(tick / 50 - position);
                const wave = hover !== null || focused ? Math.max(0, 1 - distance / 0.09) : 0;
                return (
                  <span key={tick} style={{ height: `${(tick % 5 === 0 ? 8 : 4) + wave * 6}px` }} />
                );
              })}
            </span>
            <span
              ref={anchor}
              className="video-duration-anchor"
              style={{ left: `${position * 100}%` }}
              aria-hidden="true"
            />
            <Slider.Fill />
            <Slider.Thumb
              aria-label={`视频时长：${value}秒`}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
          </Slider.Track>
          <Tooltip.Content
            key={seconds}
            triggerRef={anchor}
            placement="top"
            offset={12}
            className="video-duration-tooltip"
          >
            {seconds}秒
          </Tooltip.Content>
        </Tooltip>
        <Slider.Output className="video-duration-output">{value} 秒</Slider.Output>
      </div>
      <Slider.Marks className="video-duration-marks">
        <span>5秒</span>
        <span>30秒</span>
      </Slider.Marks>
    </Slider>
  );
}

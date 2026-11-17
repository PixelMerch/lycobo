"use client";

import { Slider } from "@heroui/react/slider";
import { ToggleButton } from "@heroui/react/toggle-button";
import { ToggleButtonGroup } from "@heroui/react/toggle-button-group";
import { IconArrowsHorizontal } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { UiIcon } from "../../../components/ui-icon";

export interface ComparisonPhotoPair {
  label: string;
  source: string;
  sourceAlt: string;
  result: string;
  resultAlt: string;
}

interface ImageComparisonProps {
  cases: readonly [ComparisonPhotoPair, ...ComparisonPhotoPair[]];
  sourceLabel: string;
  resultLabel: string;
  categoryLabel: string;
  sliderLabel: string;
}

/** 在同一取景框内对比商品原图与生成图，并支持鼠标、触摸和键盘调整分界。 */
export function ImageComparison({
  cases,
  sourceLabel,
  resultLabel,
  categoryLabel,
  sliderLabel,
}: ImageComparisonProps) {
  const hoverTimer = useRef(0);
  const [selected, setSelected] = useState(0);
  const [position, setPosition] = useState(0.5);
  const shown = cases[selected] ?? cases[0];
  const boundary = `${position * 100}%`;

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  const select = (index: number) => {
    window.clearTimeout(hoverTimer.current);
    if (index === selected) return;
    setSelected(index);
    setPosition(0.5);
  };

  return (
    <>
      <ToggleButtonGroup
        aria-label={categoryLabel}
        className="lycobo-compare-tabs flex flex-wrap justify-center"
        isDetached
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[selected]}
        onSelectionChange={(keys) => {
          const [index] = keys;
          if (typeof index === "number") select(index);
        }}
      >
        {cases.map((item, index) => (
          <ToggleButton
            key={item.label}
            id={index}
            size="md"
            onHoverStart={(event) => {
              if (event.pointerType !== "mouse") return;
              window.clearTimeout(hoverTimer.current);
              hoverTimer.current = window.setTimeout(() => select(index), 140);
            }}
            onHoverEnd={() => window.clearTimeout(hoverTimer.current)}
          >
            {item.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <div className="lycobo-compare-stage">
        <div className="lycobo-compare-labels grid grid-cols-2">
          <span>{sourceLabel}</span>
          <span>{resultLabel}</span>
        </div>
        <div className="lycobo-compare-frame relative">
          <div className="lycobo-compare-images relative overflow-hidden">
            <img
              className="absolute inset-0 size-full object-cover"
              src={shown.result}
              alt={shown.resultAlt}
              draggable={false}
            />
            <img
              className="absolute inset-0 size-full object-cover"
              src={shown.source}
              alt={shown.sourceAlt}
              style={{ clipPath: `inset(0 calc(100% - ${boundary}) 0 0)` }}
              draggable={false}
            />
            <div
              className="lycobo-compare-seam"
              style={{ insetInlineStart: boundary }}
              aria-hidden="true"
            />
          </div>
          <Slider
            className="lycobo-compare-slider absolute inset-0"
            aria-label={sliderLabel}
            minValue={0}
            maxValue={1}
            step={0.01}
            value={position}
            formatOptions={{ style: "percent", maximumFractionDigits: 0 }}
            onChange={(value) => {
              if (typeof value === "number") setPosition(value);
            }}
          >
            <Slider.Track className="lycobo-compare-track">
              <Slider.Thumb className="lycobo-compare-handle">
                <UiIcon icon={IconArrowsHorizontal} size="small" />
              </Slider.Thumb>
            </Slider.Track>
          </Slider>
        </div>
      </div>
    </>
  );
}

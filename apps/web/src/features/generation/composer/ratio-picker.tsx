import { Button, ToggleButton, ToggleButtonGroup, Toolbar } from "@heroui/react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SelectionPill } from "../../../components/selection-pill";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { composerMessages } from "./composer-messages";

const homeRatios = ["1:1", "2:3", "3:2", "9:16", "16:9", "3:4", "4:3", "21:9"];

/** 创作工具共用的比例字段，统一标题、当前值和翻页选项。 */
export function AspectRatioField({
  label,
  value,
  ratios = homeRatios,
  onChange,
}: {
  label: string;
  value: string;
  ratios?: readonly string[];
  onChange: (ratio: string) => void;
}) {
  return (
    <section className="parameter-group ratio-group" aria-label={label}>
      <div className="ratio-heading">
        <h2>{label}</h2>
        <span className="ratio-current">{value}</span>
      </div>
      <RatioOptions value={value} ratios={ratios} onChange={onChange} />
    </section>
  );
}

function RatioOptions({
  value,
  onChange,
  ratios,
}: {
  value: string;
  ratios: readonly string[];
  onChange: (ratio: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const t = useMessages(composerMessages);
  const valueRef = useRef(value);
  valueRef.current = value;
  const [edges, setEdges] = useState({ start: false, end: true });
  const alignToSelected = useCallback(
    (nextValue: string) => {
      const track = trackRef.current;
      const index = ratios.indexOf(nextValue);
      if (!track || index < 0) return;
      const target = track.children[index];
      if (!(target instanceof HTMLElement)) return;
      const box = target.getBoundingClientRect();
      const viewport = track.getBoundingClientRect();
      const inset = Number.parseFloat(getComputedStyle(track).paddingLeft) || 0;
      const leftOverflow = box.left - viewport.left - inset;
      const rightOverflow = Math.max(0, box.right - viewport.right + inset);
      const delta = leftOverflow < 0 ? leftOverflow : rightOverflow;
      if (delta) track.scrollTo({ left: Math.max(0, track.scrollLeft + delta), behavior: "auto" });
    },
    [ratios],
  );
  useLayoutEffect(() => {
    alignToSelected(value);
  }, [value, alignToSelected]);
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const update = () =>
      setEdges({
        start: track.scrollLeft > 8,
        end: track.scrollLeft + track.clientWidth < track.scrollWidth - 8,
      });
    update();
    const observer = new ResizeObserver(() => {
      alignToSelected(valueRef.current);
      update();
    });
    observer.observe(track);
    track.addEventListener("scroll", update, { passive: true });
    return () => {
      track.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [alignToSelected]);
  function page(direction: -1 | 1) {
    const track = trackRef.current;
    if (!track) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: direction * track.clientWidth, behavior: reduce ? "auto" : "smooth" });
  }
  return (
    // 翻页箭头放在同一个焦点边界内，否则从箭头返回时会在按下途中聚焦到屏幕外的比例。
    <Toolbar className="home-ratio-pager" aria-label={t.ratioPicker}>
      <ToggleButtonGroup
        ref={trackRef}
        aria-label={t.frameRatio}
        // 标出两侧是否还有更多比例，CSS 让箭头下面的选项渐隐，箭头不再压住半个选项。
        className={[
          "home-ratio-track",
          edges.start && "has-more-start",
          edges.end && "has-more-end",
        ]
          .filter(Boolean)
          .join(" ")}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[value]}
        onSelectionChange={(keys) => {
          const [next] = [...keys];
          if (next !== undefined) onChange(String(next));
        }}
      >
        {ratios.map((ratio) => (
          <ToggleButton key={ratio} id={ratio}>
            <span className="ratio-option-visual">
              <RatioPreview ratio={ratio} />
              {ratio}
            </span>
          </ToggleButton>
        ))}
        <SelectionPill value={value} />
      </ToggleButtonGroup>
      {edges.start && (
        <Button
          isIconOnly
          size="sm"
          variant="tertiary"
          className="home-ratio-arrow home-ratio-arrow-left"
          aria-label={t.previousRatios}
          onPress={() => page(-1)}
        >
          <UiIcon icon={IconChevronLeft} size="small" />
        </Button>
      )}
      {edges.end && (
        <Button
          isIconOnly
          size="sm"
          variant="tertiary"
          className="home-ratio-arrow home-ratio-arrow-right"
          aria-label={t.nextRatios}
          onPress={() => page(1)}
        >
          <UiIcon icon={IconChevronRight} size="small" />
        </Button>
      )}
    </Toolbar>
  );
}

function RatioPreview({ ratio }: { ratio: string }) {
  const [horizontal = 1, vertical = 1] = ratio.split(":").map(Number);
  const proportion = horizontal / vertical;
  const width = 24 * Math.min(1, proportion);
  const height = 24 * Math.min(1, 1 / proportion);
  return (
    <svg className="ratio-preview" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect
        x={(32 - width) / 2}
        y={(32 - height) / 2}
        width={width}
        height={height}
        rx="2"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

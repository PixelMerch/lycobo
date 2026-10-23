import { Button, Popover, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconChevronLeft, IconChevronRight, IconLayersIntersect, IconX } from "@tabler/icons-react";
import {
  type Key,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { UiIcon } from "../../../components/ui-icon";
import { SelectionHighlight } from "./selection-highlight";

const commonRatios = ["1:1", "16:9", "2:1", "3:2", "4:3"];
const additionalRatios = ["21:9", "9:16", "1:2", "2:3", "3:4", "9:21"];
const homeRatios = ["1:1", "2:3", "3:2", "9:16", "16:9", "3:4", "4:3", "21:9"];

function subscribeRatioViewport(onChange: () => void) {
  const media = window.matchMedia("(min-width: 900px)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
const getRatioViewport = () => window.matchMedia("(min-width: 900px)").matches;
const getServerRatioViewport = () => false;

/** Shared ratio selector used by the workspace and the home model settings. */
export function RatioPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (ratio: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const groupRef = useRef<HTMLElement>(null);
  const wideViewport = useSyncExternalStore(
    subscribeRatioViewport,
    getRatioViewport,
    getServerRatioViewport,
  );
  const extendedSelected = additionalRatios.includes(value);
  const select = (keys: Set<Key>) => {
    const [next] = [...keys];
    if (next === undefined) return;
    onChange(String(next));
    if (additionalRatios.includes(String(next))) setOpen(false);
  };
  return (
    <section ref={groupRef} className="parameter-group ratio-group" aria-label="图片比例">
      <div className="ratio-heading">
        <h2>图片比例</h2>
        <Popover isOpen={open} onOpenChange={setOpen}>
          <Button className="ratio-expand" variant="tertiary" aria-label="展开全部图片比例">
            <span>{value}</span>
            <span className="ratio-chevron">
              <UiIcon icon={IconChevronRight} size="small" />
            </span>
          </Button>
          <Popover.Content
            triggerRef={groupRef}
            placement={wideViewport ? "right top" : "bottom start"}
            offset={wideViewport ? 32 : 8}
            shouldFlip={!wideViewport}
            className="ratio-popover"
          >
            <Popover.Dialog className="ratio-popover-dialog" aria-label="更多图片比例">
              <div className="ratio-popover-heading">
                <Popover.Heading>图片比例</Popover.Heading>
                <Button
                  isIconOnly
                  variant="tertiary"
                  className="icon-button ratio-close"
                  aria-label="关闭图片比例"
                  onPress={() => setOpen(false)}
                >
                  <span className="ratio-close-visual">
                    <UiIcon icon={IconX} />
                  </span>
                </Button>
              </div>
              <ToggleButtonGroup
                aria-label="更多图片比例"
                className="parameter-options ratio-options ratio-extra-options"
                disallowEmptySelection
                isDetached
                selectedKeys={extendedSelected ? [value] : []}
                selectionMode="single"
                onSelectionChange={select}
              >
                {additionalRatios.map((ratio) => (
                  <ToggleButton key={ratio} id={ratio}>
                    <RatioPreview ratio={ratio} />
                    <span>{ratio}</span>
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      </div>
      <div className="parameter-options ratio-options">
        <ToggleButtonGroup
          aria-label="常用图片比例"
          className="ratio-common-options"
          disallowEmptySelection
          isDetached
          selectedKeys={commonRatios.includes(value) ? [value] : []}
          selectionMode="single"
          onSelectionChange={select}
        >
          {commonRatios.map((ratio) => (
            <ToggleButton key={ratio} id={ratio}>
              <RatioPreview ratio={ratio} />
              <span>{ratio}</span>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Button
          className="ratio-more"
          variant="tertiary"
          aria-label="更多图片比例"
          aria-haspopup="dialog"
          aria-expanded={open}
          data-selected={extendedSelected || undefined}
          onPress={() => setOpen(true)}
        >
          {extendedSelected ? (
            <RatioPreview ratio={value} />
          ) : (
            <span className="ratio-preview ratio-more-icon">
              <UiIcon icon={IconLayersIntersect} />
            </span>
          )}
          <span>{extendedSelected ? value : "更多"}</span>
        </Button>
      </div>
    </section>
  );
}

/** Horizontal ratio pager for the home model settings. */
export function HomeRatioPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (ratio: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const [edges, setEdges] = useState({ start: false, end: true });
  const alignToSelected = useCallback((nextValue: string) => {
    const track = trackRef.current;
    const index = homeRatios.indexOf(nextValue);
    if (!track || index < 0) return;
    const target = track.children[Math.floor(index / 4) * 4];
    if (!(target instanceof HTMLElement)) return;
    const offset =
      target.getBoundingClientRect().left -
      track.getBoundingClientRect().left +
      track.scrollLeft -
      3;
    track.scrollTo({ left: Math.max(0, offset), behavior: "auto" });
  }, []);
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
    <div className="home-ratio-pager">
      <ToggleButtonGroup
        ref={trackRef}
        aria-label="画面比例"
        className="home-ratio-track"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[value]}
        onSelectionChange={(keys) => {
          const [next] = [...keys];
          if (next !== undefined) onChange(String(next));
        }}
      >
        {homeRatios.map((ratio) => (
          <ToggleButton key={ratio} id={ratio}>
            {ratio === value && (
              <SelectionHighlight layoutId="home-ratio-selection" layoutDependency={value} />
            )}
            <RatioPreview ratio={ratio} />
            {ratio}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {edges.start && (
        <Button
          isIconOnly
          size="sm"
          variant="tertiary"
          className="home-ratio-arrow home-ratio-arrow-left"
          aria-label="上一页画面比例"
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
          aria-label="下一页画面比例"
          onPress={() => page(1)}
        >
          <UiIcon icon={IconChevronRight} size="small" />
        </Button>
      )}
    </div>
  );
}

export function RatioPreview({ ratio }: { ratio: string }) {
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

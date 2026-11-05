import type React from "react";
import { isValidElement, useEffect, useMemo, useRef, useState } from "react";

import {
  clamp,
  gridLayout,
  type Motion,
  useGridMotionAnimation,
} from "./use-grid-motion-animation";
import "./home-grid-motion.css";

export type GridMotionItem = React.ReactNode | { src: string; alt?: string };

export type GridMotionDirection = "alternate" | "left" | "right";

export type GridMotionProps = {
  items?: readonly GridMotionItem[];
  rows?: number;
  aspectRatio?: number;
  gap?: number;
  radius?: number;
  angle?: number;
  tilt?: number;
  speed?: number;
  direction?: GridMotionDirection;
  parallax?: number;
  spotlight?: number;
  dim?: number;
  grayscale?: boolean;
  fade?: number;
  tileColor?: string;
  textColor?: string;
  theme?: "dark" | "light";
  className?: string;
  style?: React.CSSProperties;
};

type GridStyle = React.CSSProperties & Partial<Record<`--gm-${string}`, string | number>>;

type TileData =
  | { kind: "empty" }
  | { kind: "node"; node: React.ReactNode }
  | { kind: "image"; src: string; alt: string }
  | { kind: "text"; text: string };

const THEMES = {
  dark: {
    tile: "#1b1922",
    text: "rgba(255, 255, 255, 0.78)",
    border: "rgba(255, 255, 255, 0.07)",
  },
  light: {
    tile: "#f4f4f5",
    text: "#3f3f46",
    border: "rgba(24, 24, 27, 0.08)",
  },
};

const DIRECTIONS: GridMotionDirection[] = ["alternate", "left", "right"];
const IMAGE =
  /^(https?:\/\/|\/\/|\/|\.\.?\/|data:image\/|blob:)|\.(avif|gif|jpe?g|png|svg|webp)(\?.*)?$/i;
const feather = (side: string, zone: number) => {
  const stops: string[] = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const alpha = t * t * t * (t * (t * 6 - 15) + 10);
    stops.push(`rgba(0, 0, 0, ${alpha.toFixed(4)}) ${(t * zone).toFixed(2)}%`);
  }
  const mirrored = stops.map((_, i) => {
    const t = (12 - i) / 12;
    const alpha = t * t * t * (t * (t * 6 - 15) + 10);
    return `rgba(0, 0, 0, ${alpha.toFixed(4)}) ${(100 - t * zone).toFixed(2)}%`;
  });
  return `linear-gradient(${side}, ${stops.join(", ")}, ${mirrored.join(", ")})`;
};

const toTile = (item: GridMotionItem): TileData => {
  if (item === null || item === undefined || item === false) return { kind: "empty" };
  if (isValidElement(item)) return { kind: "node", node: item };
  if (typeof item === "object" && "src" in item && typeof item.src === "string") {
    return { kind: "image", src: item.src, alt: item.alt ?? "" };
  }
  const text = String(item).trim();
  return IMAGE.test(text) ? { kind: "image", src: text, alt: "" } : { kind: "text", text };
};

const EMPTY: TileData = { kind: "empty" };

const Tile = ({ tile }: { tile: TileData }) => (
  <div className="grid-motion__tile">
    {tile.kind === "image" && (
      <img src={tile.src} alt={tile.alt} draggable={false} decoding="async" />
    )}
    {tile.kind === "text" && <span className="grid-motion__text">{tile.text}</span>}
    {tile.kind === "node" && tile.node}
  </div>
);

function useGridMotionPointer(
  rootRef: React.RefObject<HTMLDivElement | null>,
  motionRef: React.RefObject<Motion>,
  setSize: React.Dispatch<React.SetStateAction<{ width: number; height: number }>>,
) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const observer = new ResizeObserver(() => {
      const width = Math.round(root.clientWidth);
      const height = Math.round(root.clientHeight);
      setSize((current) =>
        current.width === width && current.height === height ? current : { width, height },
      );
    });
    observer.observe(root);
    const motion = motionRef.current;
    const onMove = (event: PointerEvent) => {
      // The decorative layer is inert: only exposed page surfaces may drive it.
      // A descendant control, card, header or portalled overlay is foreground UI.
      const target = event.target;
      if (
        event.pointerType === "touch" ||
        !(target instanceof Element) ||
        !target.matches(".studio-app, .main-content, .commerce-home, .home-start")
      ) {
        motion.pointer.active = false;
        return;
      }
      motion.pointer.x = event.clientX;
      motion.pointer.y = event.clientY;
      motion.pointer.active = true;
    };
    const onUp = (event: PointerEvent) => {
      if (event.pointerType === "touch") motion.pointer.active = false;
    };
    const onLeave = () => {
      motion.pointer.active = false;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("blur", onLeave);
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      observer.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("blur", onLeave);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [rootRef, motionRef, setSize]);
}

// Adapted from React Bits Grid Motion. Source and license: docs/third-party.md.
const GridMotion = ({
  items = [],
  rows = 4,
  aspectRatio = 1.33,
  gap = 16,
  radius = 14,
  angle = -12,
  tilt = 0,
  speed = 24,
  direction = "alternate",
  parallax = 0.5,
  spotlight = 0.6,
  dim = 0.35,
  grayscale = false,
  fade = 0.5,
  tileColor,
  textColor,
  theme = "dark",
  className = "",
  style,
}: GridMotionProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef<Motion>({
    offsets: [],
    shifts: [],
    intro: 0,
    pointer: { x: 0, y: 0, active: false },
  });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const palette = THEMES[theme] ?? THEMES.dark;
  const settings = {
    rows: clamp(Math.round(rows), 1, 12),
    aspect: clamp(aspectRatio, 0.3, 4),
    gap: Math.max(0, gap),
    angle,
    tilt: clamp(tilt, 0, 75),
    speed,
    direction: DIRECTIONS.includes(direction) ? direction : "alternate",
    parallax: clamp(parallax, 0, 1),
    spotlight: clamp(spotlight, 0, 1),
    dim: clamp(dim, 0, 1),
    fade: clamp(fade, 0, 1),
  };
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const layout = useMemo(
    () =>
      gridLayout(size, settings.angle, settings.tilt, settings.rows, settings.gap, settings.aspect),
    [size, settings.angle, settings.tilt, settings.rows, settings.gap, settings.aspect],
  );

  const tiles = useMemo(() => items.map(toTile), [items]);

  useGridMotionPointer(rootRef, motionRef, setSize);

  useGridMotionAnimation(rootRef, planeRef, motionRef, settingsRef, layout, reduced);

  const rowTiles = layout
    ? Array.from({ length: settings.rows }, (_, r) => ({
        id: `row-${r}`,
        top: layout.top + r * (layout.tileHeight + settings.gap),
        tiles: Array.from({ length: layout.copies * layout.perRow }, (_, k) => ({
          id: `row-${r}-tile-${k}`,
          tile: tiles[(r * layout.perRow + (k % layout.perRow)) % tiles.length] ?? EMPTY,
        })),
      }))
    : [];
  const mask =
    settings.fade > 0
      ? `${feather("to right", settings.fade * 34)}, linear-gradient(to bottom, #000 0%, #000 ${100 - settings.fade * 40}%, transparent 100%)`
      : undefined;

  const rootStyle: GridStyle = {
    "--gm-tile": tileColor ?? palette.tile,
    "--gm-text": textColor ?? palette.text,
    "--gm-border": palette.border,
    "--gm-radius": `${Math.max(0, radius)}px`,
    "--gm-dim": settings.dim,
    perspective: layout && settings.tilt > 0 ? `${layout.perspective}px` : undefined,
    maskImage: mask,
    WebkitMaskImage: mask,
    maskComposite: mask ? "intersect" : undefined,
    WebkitMaskComposite: mask ? "source-in" : undefined,
    ...style,
  };
  const planeStyle: GridStyle | undefined = layout
    ? {
        width: layout.planeWidth,
        height: layout.planeHeight,
        transform: `translate(-50%, -50%) rotateX(${settings.tilt}deg) rotateZ(${settings.angle}deg)`,
        "--gm-gap": `${settings.gap}px`,
        "--gm-tile-w": `${layout.tileWidth}px`,
        "--gm-tile-h": `${layout.tileHeight}px`,
        "--gm-font": `${clamp(layout.tileHeight * 0.12, 12, 32)}px`,
      }
    : undefined;
  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      inert
      className={`grid-motion${grayscale ? " grid-motion--gray" : ""}${className ? ` ${className}` : ""}`}
      style={rootStyle}
    >
      {layout && (
        <div ref={planeRef} className="grid-motion__plane" aria-hidden="true" style={planeStyle}>
          {rowTiles.map((row) => (
            <div key={row.id} className="grid-motion__row" style={{ top: row.top }}>
              {row.tiles.map((item) => (
                <Tile key={item.id} tile={item.tile} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GridMotion;

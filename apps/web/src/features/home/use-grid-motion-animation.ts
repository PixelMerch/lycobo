import { type RefObject, useEffect } from "react";

export type Motion = {
  offsets: number[];
  shifts: number[];
  intro: number;
  pointer: { x: number; y: number; active: boolean };
};

const INERTIA = [0.42, 0.32, 0.26, 0.22];
const PACE = [1, 0.86, 1.12, 0.94];

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
const wrap = (value: number, total: number) => ((value % total) + total) % total;
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

type GridSettings = {
  direction: "left" | "right" | "alternate";
  speed: number;
  parallax: number;
  spotlight: number;
  tilt: number;
  angle: number;
  gap: number;
};
type Layout = NonNullable<ReturnType<typeof gridLayout>>;
export function gridLayout(
  size: { width: number; height: number },
  angle: number,
  tilt: number,
  rows: number,
  gap: number,
  aspect: number,
) {
  const { width, height } = size;
  if (!width || !height) return null;
  const turn = (angle * Math.PI) / 180;
  const lean = (tilt * Math.PI) / 180;
  const cos = Math.abs(Math.cos(turn));
  const sin = Math.abs(Math.sin(turn));
  const planeHeight = ((width * sin + height * cos) / Math.max(0.3, Math.cos(lean))) * 1.12;
  const planeWidth = (width * cos + height * sin) * (1 + Math.sin(lean) * 0.9) * 1.12;
  const tileHeight = Math.max(16, (planeHeight - gap * (rows - 1)) / rows);
  const tileWidth = tileHeight * aspect;
  const step = tileWidth + gap;
  const perRow = Math.ceil(planeWidth / step) + 1;
  const period = perRow * step;
  return {
    planeWidth,
    planeHeight,
    tileWidth,
    tileHeight,
    step,
    perRow,
    period,
    copies: Math.ceil(planeWidth / period) + 2,
    top: (planeHeight - rows * tileHeight - (rows - 1) * gap) / 2,
    perspective: Math.max(width, height) * 1.5,
  };
}

function pointerLighting(
  root: HTMLElement,
  motion: Motion,
  settings: GridSettings,
  layout: Layout,
  dt: number,
) {
  const rect = root.getBoundingClientRect();
  const scale = rect.width ? root.clientWidth / rect.width : 1;
  const halfWidth = root.clientWidth / 2 || 1;
  const halfHeight = root.clientHeight / 2 || 1;
  const px = (motion.pointer.x - rect.left) * scale - halfWidth;
  const py = (motion.pointer.y - rect.top) * scale - halfHeight;
  const inside = motion.pointer.active && Math.abs(px) <= halfWidth && Math.abs(py) <= halfHeight;
  const lean = (settings.tilt * Math.PI) / 180;
  const turn = (settings.angle * Math.PI) / 180;
  const depth = layout.perspective;
  let flatY = py;
  let flatX = px;
  if (lean > 0.0001) {
    flatY = (py * depth) / (depth * Math.cos(lean) + py * Math.sin(lean));
    flatX = (px * (depth - flatY * Math.sin(lean))) / depth;
  }
  const planeX = flatX * Math.cos(turn) + flatY * Math.sin(turn);
  const planeY = -flatX * Math.sin(turn) + flatY * Math.cos(turn);
  const nudge = motion.pointer.active ? clamp(px / halfWidth, -1, 1) : 0;
  const reach = (0.6 + 2.2 * settings.spotlight) * Math.max(layout.tileWidth, layout.tileHeight);
  const settle = 1 - Math.exp(-dt / 0.22);

  return { planeX, planeY, inside, nudge, reach, settle };
}

function rowDirection(direction: GridSettings["direction"], row: number) {
  if (direction === "left") return -1;
  if (direction === "right") return 1;
  return row % 2 ? 1 : -1;
}

function rowPosition(
  s: GridSettings,
  layout: Layout,
  motion: Motion,
  r: number,
  reduce: boolean,
  dt: number,
  nudge: number,
) {
  const drift = rowDirection(s.direction, r);
  let offset = motion.offsets[r] ?? r * layout.step * 0.37;
  let shift = motion.shifts[r] ?? 0;
  if (!reduce) offset += s.speed * drift * (PACE[r % PACE.length] ?? 1) * dt;
  const target = reduce ? 0 : s.parallax * layout.tileWidth * 1.2 * nudge * (r % 2 ? -1 : 1);
  shift += (target - shift) * (1 - Math.exp(-dt / (INERTIA[r % INERTIA.length] ?? 0.22)));
  motion.offsets[r] = offset;
  motion.shifts[r] = shift;
  const x = -layout.period + wrap(offset + shift, layout.period);
  return x;
}

function spotlightChanged(value: number, mark: number, wanted: number) {
  return Math.abs(value - mark) > 0.004 || (wanted === 0 && value < 0.004 && mark !== 0);
}

function applySpotlight(
  list: HTMLElement[] | undefined,
  values: Float32Array | undefined,
  marks: Float32Array | undefined,
  r: number,
  x: number,
  layout: Layout,
  settings: GridSettings,
  lighting: ReturnType<typeof pointerLighting>,
) {
  const { inside, planeX, planeY, reach, settle } = lighting;
  const rowY =
    layout.top +
    r * (layout.tileHeight + settings.gap) +
    layout.tileHeight / 2 -
    layout.planeHeight / 2;
  const left = x - layout.planeWidth / 2 + layout.tileWidth / 2;
  if (!list || !values || !marks) return;
  const spotlightActive = inside && settings.spotlight > 0;
  for (let k = 0; k < list.length; k++) {
    let wanted = 0;
    if (spotlightActive) {
      const distance = Math.hypot(left + k * layout.step - planeX, rowY - planeY) / reach;
      wanted = 1 - smoothstep(0.25, 1, distance);
    }
    const previous = values[k] ?? 0;
    const value = previous + (wanted - previous) * settle;
    const mark = marks[k] ?? 0;
    values[k] = value;
    const tile = list[k];
    if (tile && spotlightChanged(value, mark, wanted)) {
      const nextMark = value < 0.004 ? 0 : value;
      marks[k] = nextMark;
      tile.style.setProperty("--spot", nextMark.toFixed(3));
    }
  }
}

export function useGridMotionAnimation(
  rootRef: RefObject<HTMLDivElement | null>,
  planeRef: RefObject<HTMLDivElement | null>,
  motionRef: RefObject<Motion>,
  settingsRef: RefObject<GridSettings>,
  layout: Layout | null,
  reduced: boolean,
) {
  useEffect(() => {
    const root = rootRef.current;
    const plane = planeRef.current;
    if (!root || !plane || !layout) return undefined;

    const reduce = reduced;
    const motion = motionRef.current;
    const rowEls = Array.from(plane.children).filter(
      (element): element is HTMLElement => element instanceof HTMLElement,
    );
    const tileEls = rowEls.map((row) =>
      Array.from(row.children).filter(
        (element): element is HTMLElement => element instanceof HTMLElement,
      ),
    );
    const spots = tileEls.map((list) => new Float32Array(list.length));
    const written = tileEls.map((list) => new Float32Array(list.length));
    let raf = 0;
    let last = performance.now();
    let visible = !document.hidden;
    let alive = true;
    if (reduce) motion.intro = 1;
    if (motion.intro >= 1) plane.style.opacity = "1";

    const frame = (now: number) => {
      raf = 0;
      if (!alive) return;
      const s = settingsRef.current;
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;

      if (motion.intro < 1) {
        motion.intro = Math.min(1, motion.intro + dt / 0.9);
        plane.style.opacity = String(1 - (1 - motion.intro) ** 3);
      }

      const lighting = pointerLighting(root, motion, s, layout, dt);
      rowEls.forEach((row, r) => {
        const x = rowPosition(s, layout, motion, r, reduce, dt, lighting.nudge);
        row.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;

        applySpotlight(tileEls[r], spots[r], written[r], r, x, layout, s, lighting);
      });

      if (visible && !document.hidden && !reduce) raf = requestAnimationFrame(frame);
    };

    const refresh = () => {
      root.dataset.playing = String(visible && !document.hidden && !reduce);
      if (visible && !document.hidden && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      } else if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    document.addEventListener("visibilitychange", refresh);
    const visibility = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      refresh();
    });
    visibility.observe(root);
    raf = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      visibility.disconnect();
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [layout, reduced, rootRef, planeRef, motionRef, settingsRef]);
}

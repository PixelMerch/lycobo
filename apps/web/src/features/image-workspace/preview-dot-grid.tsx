import { type RefObject, useEffect, useRef } from "react";

const SPACING = 21;
const OFFSET = 3;
const LIFETIME = 1000;

type Ripple = { x: number; y: number; started: number };

/** Decorative only: pointer events stay with the image and its editing layer. */
function dotOpacity(ripples: Ripple[], now: number, x: number, y: number) {
  let alpha = 0;
  for (const ripple of ripples) {
    const age = (now - ripple.started) / LIFETIME;
    const distance = Math.hypot(x - ripple.x, y - ripple.y);
    const ring = Math.max(0, 1 - Math.abs(distance - age * 240) / 48);
    const center = Math.max(0, 1 - distance / 95) * (1 - age);
    alpha = Math.max(alpha, Math.max(ring, center) * (1 - age) * 0.95);
  }
  return alpha;
}

function canTrackPointer(event: PointerEvent, reduced: boolean, finePointer: boolean) {
  if (reduced || !finePointer || document.hidden || event.pointerType !== "mouse") return false;
  return !(event.target instanceof Element && event.target.closest(".preview-canvas-dock"));
}

export function PreviewDotGrid({ stage }: { stage: RefObject<HTMLElement | null> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const area = stage.current;
    const layer = canvas.current;
    const context = layer?.getContext("2d");
    if (!area || !layer || !context) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(any-pointer: fine)");
    let width = 0;
    let height = 0;
    let frame = 0;
    let ripples: Ripple[] = [];
    let last: Ripple | undefined;
    const clear = () => context.clearRect(0, 0, width, height);
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      ripples = [];
      last = undefined;
      clear();
    };
    const draw = (now: number) => {
      frame = 0;
      clear();
      ripples = ripples.filter((ripple) => now - ripple.started < LIFETIME);
      for (let x = OFFSET; x < width; x += SPACING) {
        for (let y = OFFSET; y < height; y += SPACING) {
          const alpha = dotOpacity(ripples, now, x, y);
          if (alpha < 0.01) continue;
          context.fillStyle = `rgba(255,255,255,${alpha})`;
          context.fillRect(x - 0.5, y - 0.5, 1, 1);
        }
      }
      if (ripples.length) frame = requestAnimationFrame(draw);
    };
    const resize = () => {
      stop();
      width = area.clientWidth;
      height = area.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      layer.width = Math.round(width * ratio);
      layer.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const move = (event: PointerEvent) => {
      if (!canTrackPointer(event, reduced.matches, finePointer.matches)) return;
      const bounds = area.getBoundingClientRect();
      const next = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        started: performance.now(),
      };
      if (
        last &&
        (next.started - last.started < 70 || Math.hypot(next.x - last.x, next.y - last.y) < 12)
      )
        return;
      last = next;
      ripples = [...ripples.slice(-7), next];
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(area);
    area.addEventListener("pointermove", move, { passive: true });
    reduced.addEventListener("change", stop);
    finePointer.addEventListener("change", stop);
    document.addEventListener("visibilitychange", stop);
    return () => {
      stop();
      observer.disconnect();
      area.removeEventListener("pointermove", move);
      reduced.removeEventListener("change", stop);
      finePointer.removeEventListener("change", stop);
      document.removeEventListener("visibilitychange", stop);
    };
  }, [stage]);
  return (
    <div className="preview-dot-grid" aria-hidden="true" inert>
      <canvas ref={canvas} />
    </div>
  );
}

import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { easedImageZoom, imageWheelFactor } from "../../components/image-viewer/image-zoom-motion";

export const previewDefaultZoom = 80;
export const previewMinZoom = 25;
const clamp = (value: number) => Math.min(500, Math.max(previewMinZoom, value));

export function wheelZoomTarget(goal: number, delta: number, ctrlKey = false) {
  return clamp(goal * imageWheelFactor(delta, ctrlKey));
}

export function usePreviewZoom() {
  const [zoom, updateZoom] = useState(previewDefaultZoom);
  const current = useRef(previewDefaultZoom);
  const goal = useRef(previewDefaultZoom);
  const frame = useRef<number | null>(null);
  const reducedMotion = useReducedMotion();
  const setZoom = useCallback((value: number) => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    goal.current = current.current = clamp(value);
    updateZoom(current.current);
  }, []);
  const wheelZoom = useCallback(
    (delta: number, ctrlKey = false) => {
      goal.current = wheelZoomTarget(goal.current, delta, ctrlKey);
      if (reducedMotion) {
        current.current = goal.current;
        updateZoom(current.current);
        return;
      }
      if (frame.current !== null || current.current === goal.current) return;
      let last = performance.now();
      const tick = (now: number) => {
        const elapsed = Math.min(64, now - last);
        last = now;
        current.current = easedImageZoom(current.current, goal.current, elapsed);
        updateZoom(current.current);
        frame.current = current.current === goal.current ? null : requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    },
    [reducedMotion],
  );
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );
  return { zoom, setZoom, wheelZoom };
}

import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { easedImageZoom } from "./image-zoom-motion";

export function useImageViewerZoom(resetPan: () => void) {
  const reducedMotion = useReducedMotion();
  const [zoom, setZoom] = useState(100);
  const zoomValue = useRef(100);
  const zoomGoal = useRef(100);
  const zoomFrame = useRef<number | null>(null);
  /* Zoom is eased toward its goal so wheel input and button steps stay smooth
   * instead of jumping a fixed step per event. */
  const animateZoom = () => {
    if (zoomFrame.current !== null) return;
    let last = performance.now();
    const step = (now: number) => {
      const elapsed = Math.min(64, now - last);
      last = now;
      const goal = zoomGoal.current;
      const current = zoomValue.current;
      const next = easedImageZoom(current, goal, elapsed);
      zoomValue.current = next;
      setZoom(next);
      zoomFrame.current = next === goal ? null : requestAnimationFrame(step);
    };
    zoomFrame.current = requestAnimationFrame(step);
  };
  const zoomTo = (value: number) => {
    zoomGoal.current = Math.min(500, Math.max(25, value));
    resetPan();
    if (reducedMotion) {
      zoomValue.current = zoomGoal.current;
      setZoom(zoomGoal.current);
      return;
    }
    animateZoom();
  };
  const zoomBy = (factor: number) => zoomTo(zoomGoal.current * factor);
  useEffect(
    () => () => {
      if (zoomFrame.current !== null) cancelAnimationFrame(zoomFrame.current);
    },
    [],
  );
  const reset = () => {
    if (zoomFrame.current !== null) {
      cancelAnimationFrame(zoomFrame.current);
      zoomFrame.current = null;
    }
    zoomValue.current = 100;
    zoomGoal.current = 100;
    setZoom(100);
  };
  return { zoom, zoomBy, zoomStep: (delta: number) => zoomTo(zoomGoal.current + delta), reset };
}

import { useInView } from "motion/react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { createGalleryLoop } from "./gallery-loop";

function subscribeReducedMotion(notify: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}

const readReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 单向循环图带保留原生触摸与箭头浏览，悬停、焦点和后台状态暂停自动推进。 */
export function useGalleryAutoplay() {
  const rail = useRef<HTMLElement>(null);
  const visible = useInView(rail);
  const reduced = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => true);
  const interaction = useRef({ hovered: false, focused: false, dragging: false });
  const controller = useRef<ReturnType<typeof createGalleryLoop> | null>(null);
  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const loop = createGalleryLoop(element, reduced, visible, () => {
      const current = interaction.current;
      return current.hovered || current.focused || current.dragging;
    });
    controller.current = loop;
    const releasePointer = () => {
      interaction.current.dragging = false;
      loop.hold();
    };
    window.addEventListener("pointerup", releasePointer);
    window.addEventListener("pointercancel", releasePointer);
    return () => {
      loop.dispose();
      controller.current = null;
      window.removeEventListener("pointerup", releasePointer);
      window.removeEventListener("pointercancel", releasePointer);
    };
  }, [visible, reduced]);
  return {
    rail,
    reduced,
    interaction,
    hold: () => controller.current?.hold(),
    move: (direction: number) => controller.current?.move(direction),
  };
}

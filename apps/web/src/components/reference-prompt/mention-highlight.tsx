import { cancelFrame, frame } from "motion";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useLayoutEffect, useRef } from "react";
import { springAt, stepSpring } from "../highlight-spring";
import { mentionSprings } from "./mention-motion";

function activeOption(list: HTMLElement) {
  return (
    list.querySelector<HTMLElement>(
      '[data-focus-visible="true"][role="option"]:not([data-disabled])',
    ) ??
    list.querySelector<HTMLElement>('[data-hovered="true"][role="option"]:not([data-disabled])')
  );
}

const highlightHeight = 36;

function highlightTop(list: HTMLElement) {
  const row = activeOption(list);
  // 使用布局坐标，高亮不会追着正在回弹或按压的内容移动。
  return row ? row.offsetTop + (row.offsetHeight - highlightHeight) / 2 : null;
}

function useMentionHighlight() {
  const highlightRef = useRef<HTMLSpanElement>(null);
  const top = useMotionValue(0);
  const bottom = useMotionValue(0);
  const opacity = useMotionValue(0);
  const reducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    const list = highlightRef.current?.parentElement;
    if (!list) return;
    const fade = reducedMotion ? { duration: 0 } : mentionSprings.fade;
    let visible = false;
    let springs: ReturnType<typeof mentionEdges> | null = null;

    function advance({ delta }: { delta: number }) {
      if (!springs) return;
      const topDone = stepSpring(springs.top, delta);
      const bottomDone = stepSpring(springs.bottom, delta);
      top.set(springs.top.position);
      bottom.set(springs.bottom.position);
      if (topDone && bottomDone) cancelFrame(advance);
    }

    function move(start: number) {
      if (!springs || reducedMotion) {
        cancelFrame(advance);
        springs = mentionEdges(start);
        top.jump(springs.top.position);
        bottom.jump(springs.bottom.position);
        return;
      }
      if (springs.top.target === start) return;
      retargetMentionEdges(springs, start);
      frame.update(advance, true);
    }

    const update = () => {
      const start = highlightTop(list);
      const nextVisible = start !== null;
      if (visible !== nextVisible) void animate(opacity, nextVisible ? 1 : 0, fade);
      visible = nextVisible;
      // 指针越过选项之间的空隙时保留上次位置，下次仍从这里滑过去。
      if (start !== null) move(start);
    };
    const changes = new MutationObserver(update);
    const size = new ResizeObserver(update);
    changes.observe(list, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-hovered", "data-focus-visible", "data-disabled"],
    });
    size.observe(list);
    update();
    return () => {
      changes.disconnect();
      size.disconnect();
      cancelFrame(advance);
      opacity.stop();
    };
  }, [bottom, opacity, reducedMotion, top]);

  const clipPath = useTransform(
    [top, bottom],
    ([start, end]) => `inset(${start}px 0 calc(100% - ${end}px) 0 round var(--control-radius))`,
  );
  return { highlightRef, clipPath, opacity };
}

function mentionEdges(start: number) {
  return {
    top: springAt(start, mentionSprings.lead),
    bottom: springAt(start + highlightHeight, mentionSprings.lead),
  };
}

function retargetMentionEdges(edges: ReturnType<typeof mentionEdges>, start: number) {
  const down = start > edges.top.target;
  edges.top.target = start;
  edges.bottom.target = start + highlightHeight;
  edges.top.parameters = down ? mentionSprings.trail : mentionSprings.lead;
  edges.bottom.parameters = down ? mentionSprings.lead : mentionSprings.trail;
}

/** 复用选项本身的悬停与焦点，将独立的上下边缘弹簧绘制成一个高亮底板。 */
export function MentionHighlight() {
  const { highlightRef, clipPath, opacity } = useMentionHighlight();
  return (
    <motion.span
      ref={highlightRef}
      className="reference-mention-highlight"
      aria-hidden="true"
      style={{ clipPath, opacity }}
    />
  );
}

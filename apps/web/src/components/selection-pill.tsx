import { cancelFrame, frame } from "motion";
import { motion, useMotionValue, useReducedMotion } from "motion/react";
import { useCallback, useLayoutEffect, useRef } from "react";
import { springAt, stepSpring } from "./highlight-spring";
import "./selection-pill.css";

// 沿用 DesignBookmark 的前后缘刚度，降低阻尼以明显呈现回弹。
const leadingEdge = { stiffness: 620, damping: 30 };
const trailingEdge = { stiffness: 190, damping: 15 };

function measureSelection(group: HTMLElement) {
  const selected = group.querySelector<HTMLButtonElement>(
    ':scope > button[data-selected="true"]:not(:disabled, [data-disabled="true"])',
  );
  if (!selected?.offsetWidth) return null;

  // 相对按钮组的坐标包含横向滚动内容，底板会随比例列表一起滚动。
  const last = group.querySelector<HTMLButtonElement>(":scope > button:last-of-type");
  return {
    width: Math.max(group.clientWidth, last ? last.offsetLeft + last.offsetWidth : 0),
    left: selected.offsetLeft,
    right: selected.offsetLeft + selected.offsetWidth,
    top: selected.offsetTop,
    height: selected.offsetHeight,
    radius: getComputedStyle(selected).borderRadius,
  };
}

// 裁剪固定尺寸的底板，拉伸时保持圆角，避免每帧改变选项布局。
function selectionClip(width: number, radius: string, left: number, right: number) {
  const start = Math.max(0, left);
  const end = Math.max(0, width - Math.max(start, right));
  return `inset(0 ${end}px 0 ${start}px round ${radius})`;
}

/** 在单选按钮组内滑动选中底板，两侧用独立弹簧保留拉伸效果。 */
export function SelectionPill({ value }: { value: string }) {
  const pillRef = useRef<HTMLSpanElement>(null);
  const previousValue = useRef(value);
  const previousBounds = useRef<ReturnType<typeof measureSelection>>(null);
  const edges = useRef({ left: springAt(0, leadingEdge), right: springAt(0, leadingEdge) });
  const reduceMotion = useReducedMotion();
  const clipPath = useMotionValue("inset(50%)");

  const advance = useCallback(
    function advanceFrame({ delta }: { delta: number }) {
      const bounds = previousBounds.current;
      if (!bounds) return;
      const spring = edges.current;
      const leftSettled = stepSpring(spring.left, delta);
      const rightSettled = stepSpring(spring.right, delta);
      clipPath.set(
        selectionClip(bounds.width, bounds.radius, spring.left.position, spring.right.position),
      );
      if (leftSettled && rightSettled) cancelFrame(advanceFrame);
    },
    [clipPath],
  );

  const update = useCallback(
    (snap: boolean) => {
      const pill = pillRef.current;
      const group = pill?.parentElement;
      if (!pill || !group) return;
      const bounds = measureSelection(group);
      if (!bounds) {
        cancelFrame(advance);
        pill.style.visibility = "hidden";
        previousBounds.current = null;
        return;
      }

      const oldLeft = previousBounds.current?.left;

      pill.style.width = `${bounds.width}px`;
      pill.style.top = `${bounds.top}px`;
      pill.style.height = `${bounds.height}px`;
      previousBounds.current = bounds;
      if (snap || reduceMotion || oldLeft === undefined || oldLeft === bounds.left) {
        cancelFrame(advance);
        edges.current = {
          left: springAt(bounds.left, leadingEdge),
          right: springAt(bounds.right, leadingEdge),
        };
        clipPath.set(selectionClip(bounds.width, bounds.radius, bounds.left, bounds.right));
      } else {
        const spring = edges.current;
        const movingRight = bounds.left > oldLeft;
        spring.left.target = bounds.left;
        spring.right.target = bounds.right;
        spring.left.parameters = movingRight ? trailingEdge : leadingEdge;
        spring.right.parameters = movingRight ? leadingEdge : trailingEdge;
        frame.update(advance, true);
      }
      pill.style.visibility = "visible";
    },
    [advance, clipPath, reduceMotion],
  );

  useLayoutEffect(() => {
    update(previousValue.current === value);
    previousValue.current = value;
  }, [update, value]);

  useLayoutEffect(() => {
    const group = pillRef.current?.parentElement;
    if (!group) return;
    const observer = new ResizeObserver(() => update(true));
    observer.observe(group);
    return () => {
      observer.disconnect();
      cancelFrame(advance);
    };
  }, [update, advance]);

  return (
    <motion.span ref={pillRef} className="selection-pill" aria-hidden="true" style={{ clipPath }} />
  );
}

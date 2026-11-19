import { spring } from "motion";
import type { CSSProperties } from "react";

// DesignBookmark 共享参数，菜单和胶囊用现有 Motion 生成曲线。
export const mentionSprings = {
  soft: { type: "spring", stiffness: 260, damping: 24 },
  fade: { type: "spring", stiffness: 420, damping: 32 },
  pop: { type: "spring", stiffness: 520, damping: 16 },
  lead: { type: "spring", stiffness: 620, damping: 36 },
  trail: { type: "spring", stiffness: 190, damping: 19 },
} as const;

function cssSpring(parameters: { stiffness: number; damping: number }) {
  return spring({ keyframes: [0, 1], restDelta: 0.02, restSpeed: 0.2, ...parameters }).toString();
}

export const mentionMotionStyle: CSSProperties & Record<`--mention-${string}`, string> = {
  "--mention-soft-spring": cssSpring(mentionSprings.soft),
  "--mention-fade-spring": cssSpring(mentionSprings.fade),
  "--mention-pop-spring": cssSpring(mentionSprings.pop),
} as const;

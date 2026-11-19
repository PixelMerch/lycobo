import type { CSSProperties } from "react";
import { cssSpring } from "../css-spring";

// DesignBookmark 共享参数，菜单和胶囊用现有 Motion 生成曲线。
export const mentionSprings = {
  soft: { type: "spring", stiffness: 260, damping: 24 },
  fade: { type: "spring", stiffness: 420, damping: 32 },
  pop: { type: "spring", stiffness: 520, damping: 16 },
  lead: { type: "spring", stiffness: 620, damping: 36 },
  trail: { type: "spring", stiffness: 190, damping: 19 },
} as const;

export const mentionMotionStyle: CSSProperties & Record<`--mention-${string}`, string> = {
  "--mention-soft-spring": cssSpring(mentionSprings.soft),
  "--mention-fade-spring": cssSpring(mentionSprings.fade),
  "--mention-pop-spring": cssSpring(mentionSprings.pop),
} as const;

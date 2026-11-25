import type { CSSProperties } from "react";
import { cssSpring } from "../../components/css-spring";

// 宽度使用 DesignBookmark 共享的 soft 弹簧，名称与图标保留 Sidebar collapse 的专用参数。
const labelSpring = cssSpring({ stiffness: 300, damping: 26 });

export const workspaceRailMotionStyle: CSSProperties &
  Record<`--workspace-rail-${string}`, string> = {
  "--workspace-rail-width-spring": cssSpring({ stiffness: 260, damping: 24 }),
  "--workspace-rail-label-spring": labelSpring,
  "--workspace-rail-label-duration": labelSpring.split(" ", 1)[0] ?? "0s",
  "--workspace-rail-icon-spring": cssSpring({ stiffness: 300, damping: 22 }),
};

/** 名称在展开后从上到下滑入，关闭时的延迟由样式统一清零。 */
export function workspaceRailLabelStyle(index: number): CSSProperties & {
  "--workspace-rail-label-delay": string;
} {
  return { "--workspace-rail-label-delay": `${60 + 40 * index}ms` };
}

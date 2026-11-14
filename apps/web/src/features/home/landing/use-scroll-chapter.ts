import type { MotionValue } from "motion/react";
import { useCallback, useSyncExternalStore } from "react";

/** 依据滚动阈值计算当前展示章节，反向滚动与直接跳转使用同一规则。 */
export function scrollChapterIndex(progress: number, thresholds: readonly number[]) {
  return thresholds.filter((threshold) => progress >= threshold).length;
}

/** 只在滚动跨越章节时触发渲染，不逐帧把滚动值写入 React 状态。 */
export function useScrollChapter(progress: MotionValue<number>, thresholds: readonly number[]) {
  const subscribe = useCallback((notify: () => void) => progress.on("change", notify), [progress]);
  const snapshot = useCallback(
    () => scrollChapterIndex(progress.get(), thresholds),
    [progress, thresholds],
  );
  return useSyncExternalStore(subscribe, snapshot, () => 0);
}

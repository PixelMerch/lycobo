import { type MotionValue, motion, useTransform } from "motion/react";

const palettes = {
  textile: ["#232a25", "#4b493e", "#384c4a"],
  comparison: ["#ede7dd", "#dce8df", "#e1e3ed"],
  set: ["#e6e3df", "#e0e7df", "#dddfe9"],
} as const;

/** 通过三层实色透明度随滚动交接背景，避免逐帧绘制大面积模糊。 */
export function CommerceBackdrop({
  progress,
  enabled,
  tone,
}: {
  progress: MotionValue<number>;
  enabled: boolean;
  tone: keyof typeof palettes;
}) {
  const middle = useTransform(progress, [0, 0.5, 1], [0, 1, 1]);
  const last = useTransform(progress, [0.5, 1], [0, 1]);
  const colors = palettes[tone];
  return (
    <div className="commerce-story-backdrop" aria-hidden="true">
      <div style={{ backgroundColor: colors[0] }} />
      <motion.div style={{ backgroundColor: colors[1], opacity: enabled ? middle : 0 }} />
      <motion.div style={{ backgroundColor: colors[2], opacity: enabled ? last : 0 }} />
    </div>
  );
}

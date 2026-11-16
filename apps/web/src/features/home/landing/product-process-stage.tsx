import { type MotionValue, motion, useTransform } from "motion/react";
import { ProductSilhouette } from "./product-frame";

// 每段中点保持构图稳定，段与段之间留出商品和布景的过渡距离。
const poses = [0, 0.14, 0.35, 0.43, 0.6, 0.68, 0.87, 1];

/** 让同一个商品随进度完成取景、换布景和推近特写。 */
export function ProductProcessStage({ progress }: { progress: MotionValue<number> }) {
  const x = useTransform(progress, poses, ["-12%", "-12%", "0%", "0%", "14%", "14%", "2%", "2%"]);
  const y = useTransform(progress, poses, ["8%", "8%", "-4%", "-4%", "3%", "3%", "39%", "39%"]);
  const scale = useTransform(progress, poses, [0.68, 0.68, 1.02, 1.02, 0.9, 0.9, 2.55, 2.55]);
  const crop = useTransform(progress, [0.14, 0.35], [1, 0]);
  const lighting = useTransform(progress, [0.14, 0.35, 0.43, 0.6], [0, 1, 1, 0]);
  const scene = useTransform(progress, [0.43, 0.6, 0.68, 0.87], [0, 1, 1, 0]);
  const settingY = useTransform(progress, [0.43, 0.6], ["24%", "0%"]);

  return (
    <div className="commerce-process-frame" aria-hidden="true">
      <motion.div className="commerce-process-lighting" style={{ opacity: lighting }} />
      <motion.div className="commerce-process-setting" style={{ y: settingY, opacity: scene }} />
      <motion.div className="commerce-process-object" style={{ x, y, scale }}>
        <ProductSilhouette />
      </motion.div>
      <motion.div className="commerce-process-crop" style={{ opacity: crop }} />
    </div>
  );
}

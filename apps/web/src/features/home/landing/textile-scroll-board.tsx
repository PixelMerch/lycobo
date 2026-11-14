import { Button } from "@heroui/react";
import { type MotionValue, motion, useTransform } from "motion/react";
import { useMessages } from "../../../i18n/messages";
import { textileFeatureMessages } from "./textile-feature-messages";

type TextileView = "front" | "pillow" | "fabric" | "bed-end";
type StoryProps = {
  selected: TextileView;
  onOpen: () => void;
  progress: MotionValue<number>;
};

/** 主图从中央退到左侧，局部照片随滚动依次展开，向上滚动按同一路径回收。 */
export function TextileScrollBoard({ selected, onOpen, progress }: StoryProps) {
  const t = useMessages(textileFeatureMessages);
  const x = useTransform(progress, [0.08, 0.42], ["66%", "0%"]);
  const scale = useTransform(progress, [0.08, 0.42], [1.08, 1]);
  const labelOpacity = useTransform(progress, [0.1, 0.25], [1, 0]);
  return (
    <div className="commerce-textile-story">
      <motion.div className="commerce-textile-story-main" style={{ x, scale }}>
        <Button
          className="commerce-textile-story-open"
          variant="ghost"
          aria-label={t.open}
          aria-describedby="commerce-textile-description"
          onPress={onOpen}
        >
          <img
            src={`/studio/textile-views/${selected}.webp`}
            alt={t.views[selected].title}
            loading="lazy"
          />
        </Button>
        <motion.span className="commerce-textile-story-caption" style={{ opacity: labelOpacity }}>
          {t.views[selected].title}
        </motion.span>
      </motion.div>
      <TextileDetail view="pillow" progress={progress} start={0.22} end={0.56} />
      <TextileDetail view="fabric" progress={progress} start={0.36} end={0.7} />
      <TextileDetail view="bed-end" progress={progress} start={0.54} end={0.9} />
    </div>
  );
}

/** 每张细节照片有独立的滚动区间，保持连续位移而非阈值触发的入场动画。 */
function TextileDetail({
  view,
  progress,
  start,
  end,
}: {
  view: Exclude<TextileView, "front">;
  progress: MotionValue<number>;
  start: number;
  end: number;
}) {
  const t = useMessages(textileFeatureMessages).views[view];
  const x = useTransform(progress, [start, end], ["-95%", "0%"]);
  const y = useTransform(progress, [start, end], [56, 0]);
  const rotate = useTransform(progress, [start, end], [-7, 0]);
  const opacity = useTransform(progress, [start, start + 0.12], [0, 1]);
  const scale = useTransform(progress, [start, end], [0.86, 1]);
  return (
    <motion.figure
      className={`commerce-textile-story-detail commerce-textile-story-${view}`}
      style={{ x, y, rotate, opacity, scale }}
    >
      <img src={`/studio/textile-views/${view}.webp`} alt={t.title} loading="lazy" />
      <figcaption>{t.title}</figcaption>
    </motion.figure>
  );
}

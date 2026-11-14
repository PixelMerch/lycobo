import { Button } from "@heroui/react";
import { motion, useTransform } from "motion/react";
import { useMessages } from "../../../i18n/messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import type { useCommerceScroll } from "./use-commerce-scroll";

type Story = ReturnType<typeof useCommerceScroll>;

/** 以穿着图为固定视觉中心，让局部和场景从其后方展开。 */
export function ImageSetBoard({ story, onOpen }: { story: Story; onOpen: () => void }) {
  const t = useMessages(commerceShowcaseMessages).set;
  const scale = useTransform(story.progress, [0.08, 0.62], [1.12, 1]);
  return (
    <Button variant="ghost" className="commerce-set-board" aria-label={t.open} onPress={onOpen}>
      <motion.span
        className="commerce-set-photo commerce-set-lead"
        style={story.enabled ? { scale } : { scale: 1 }}
      >
        <img src="/landing/commerce/p11-worn.webp" alt={t.alt} loading="lazy" />
        <span>{t.full}</span>
      </motion.span>
      <SetDetail view="zipper" story={story} start={0.14} end={0.62} />
      <SetDetail view="fabric" story={story} start={0.28} end={0.76} />
      <SetDetail view="scene" story={story} start={0.38} end={0.88} />
    </Button>
  );
}

/** 左侧展示两张工艺特写，右侧场景图稍后完成展开。 */
function SetDetail({
  view,
  story,
  start,
  end,
}: {
  view: "zipper" | "fabric" | "scene";
  story: Story;
  start: number;
  end: number;
}) {
  const t = useMessages(commerceShowcaseMessages).set;
  const x = useTransform(story.progress, [start, end], [view === "scene" ? "-108%" : "108%", "0%"]);
  const y = useTransform(story.progress, [start, end], [view === "fabric" ? -40 : 40, 0]);
  const rotate = useTransform(story.progress, [start, end], [view === "scene" ? -6 : 6, 0]);
  const opacity = useTransform(story.progress, [start, start + 0.16], [0, 1]);
  return (
    <motion.span
      className={`commerce-set-photo commerce-set-${view}`}
      style={story.enabled ? { x, y, rotate, opacity } : { x: 0, y: 0, rotate: 0, opacity: 1 }}
    >
      <img src={`/landing/commerce/p11-${view}.webp`} alt="" loading="lazy" />
      <span>{t[view]}</span>
    </motion.span>
  );
}

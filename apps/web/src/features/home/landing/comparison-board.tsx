import { IconArrowRight } from "@tabler/icons-react";
import { motion, useTransform } from "motion/react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import type { useCommerceScroll } from "./use-commerce-scroll";

/** 用不同面积和连续交接呈现原图与成片，不把滚动伪装成实际生成任务。 */
export function ComparisonBoard({
  example,
  alt,
  story,
}: {
  example: { reference: string; result: string };
  alt: string;
  story: ReturnType<typeof useCommerceScroll>;
}) {
  const t = useMessages(commerceShowcaseMessages);
  const referenceX = useTransform(story.progress, [0.02, 0.16], ["105%", "0%"]);
  const referenceScale = useTransform(story.progress, [0.02, 0.16], [1.4, 1]);
  const resultX = useTransform(story.progress, [0.06, 0.24], ["32%", "0%"]);
  const resultY = useTransform(story.progress, [0.06, 0.24], [64, 0]);
  const resultScale = useTransform(story.progress, [0.06, 0.24], [0.88, 1]);
  const resultOpacity = useTransform(story.progress, [0.06, 0.16], [0, 1]);
  const arrowOpacity = useTransform(story.progress, [0.14, 0.22], [0, 1]);
  return (
    <div className="commerce-comparison-board">
      <motion.figure
        className="commerce-comparison-original"
        style={story.enabled ? { x: referenceX, scale: referenceScale } : { x: 0, scale: 1 }}
      >
        <img
          src={`/landing/commerce/${example.reference}.webp`}
          alt={`${t.reference} · ${alt}`}
          loading="lazy"
        />
        <figcaption>{t.reference}</figcaption>
      </motion.figure>
      <motion.span
        className="commerce-comparison-direction"
        aria-hidden="true"
        style={story.enabled ? { opacity: arrowOpacity } : { opacity: 1 }}
      >
        <UiIcon icon={IconArrowRight} size="action" />
      </motion.span>
      <motion.figure
        className="commerce-comparison-finished"
        style={
          story.enabled
            ? { x: resultX, y: resultY, scale: resultScale, opacity: resultOpacity }
            : { x: 0, y: 0, scale: 1, opacity: 1 }
        }
      >
        <img
          src={`/landing/commerce/${example.result}.webp`}
          alt={`${t.result} · ${alt}`}
          loading="lazy"
        />
        <figcaption>{t.result}</figcaption>
      </motion.figure>
    </div>
  );
}

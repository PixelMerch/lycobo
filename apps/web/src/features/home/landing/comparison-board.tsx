import { IconArrowRight } from "@tabler/icons-react";
import { motion, useTransform } from "motion/react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import type { useCommerceScroll } from "./use-commerce-scroll";

/** 原图与成片从进入视口起均可见，滚动只轻移成片并切换商品。 */
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
  const y = useTransform(story.progress, [0, 0.2], [24, 0]);
  return (
    <div className="commerce-comparison-board">
      <figure className="commerce-comparison-original">
        <img
          src={`/landing/commerce/${example.reference}.webp`}
          alt={`${t.reference} · ${alt}`}
          loading="lazy"
        />
        <figcaption>{t.reference}</figcaption>
      </figure>
      <span className="commerce-comparison-direction" aria-hidden="true">
        <UiIcon icon={IconArrowRight} size="action" />
      </span>
      <motion.figure
        className="commerce-comparison-finished"
        style={story.enabled ? { y } : { y: 0 }}
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

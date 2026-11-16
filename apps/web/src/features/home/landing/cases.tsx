import { motion } from "motion/react";
import { useMessages } from "../../../i18n/messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { ComparisonBoard } from "./comparison-board";
import { useCommerceScroll } from "./use-commerce-scroll";
import { useScrollChapter } from "./use-scroll-chapter";

const examples = [
  { id: "studio", reference: "p01-reference", result: "p01-serum-hero" },
  { id: "scene", reference: "p02-reference", result: "p02-kitchen" },
  { id: "apparel", reference: "p11-jacket-mother", result: "p11-worn" },
] as const;
const thresholds = [0.36, 0.68] as const;

/** 滚动依次切换三组成片对比；小屏和减少动态效果时完整顺序呈现。 */
export function Cases() {
  const t = useMessages(commerceShowcaseMessages);
  const story = useCommerceScroll();
  const chapter = useScrollChapter(story.progress, thresholds);
  const selected = examples[chapter] ?? examples[0];
  return (
    <section
      ref={story.target}
      data-scroll-story={story.enabled}
      className="commerce-scroll-section commerce-comparison"
      aria-labelledby="commerce-results-title"
    >
      <div className="commerce-scroll-pin">
        <div className="commerce-section commerce-comparison-layout">
          <div className="commerce-story-heading">
            <h2 id="commerce-results-title">{t.title}</h2>
          </div>
          {story.enabled ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.24 }}
            >
              <ComparisonBoard
                example={selected}
                alt={t.comparisons[selected.id].alt}
                story={story}
              />
            </motion.div>
          ) : (
            <div className="commerce-comparison-list">
              {examples.map((example) => (
                <ComparisonBoard
                  key={example.id}
                  example={example}
                  alt={t.comparisons[example.id].alt}
                  story={story}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

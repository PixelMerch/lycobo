import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconArrowDown, IconArrowUpRight } from "@tabler/icons-react";
import { motion } from "motion/react";
import { useState, useSyncExternalStore } from "react";
import { RouteLink } from "../../../components/router-link";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { productStoryMessages } from "./product-story-messages";
import { ProductStoryStage } from "./product-story-stage";
import { useShowcaseScroll } from "./use-showcase-scroll";

const chapterSteps = [0, 1, 3];

/** 监听系统偏好变化，页面打开期间切换减少动态效果也立即生效。 */
function subscribeReducedMotion(notify: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}

const readReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 原生滚动推进商品叙事；手动选择立即定位，不写入草稿或提交生成任务。 */
export function ProductStory() {
  const t = useMessages(productStoryMessages);
  const chapter = useShowcaseScroll(4);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, readReducedMotion, () => true);
  const [manualStep, setManualStep] = useState<number | null>(null);
  const activeTab = chapter.active === 3 ? 2 : Math.min(chapter.active, 1);
  const instant = Boolean(reducedMotion) || manualStep === chapter.active;
  return (
    <section ref={chapter.section} className="product-story" aria-labelledby="product-story-title">
      <header className="product-story-heading">
        <h2 id="product-story-title">{t.title}</h2>
        <p>{t.description}</p>
      </header>
      <div className="product-story-sticky">
        <div className="product-story-shell" data-step={chapter.active} data-instant={instant}>
          <div className="product-story-wash product-story-wash--sage" aria-hidden="true" />
          <div className="product-story-wash product-story-wash--rose" aria-hidden="true" />
          <ToggleButtonGroup
            className="product-story-tabs"
            aria-label={t.navigation}
            selectionMode="single"
            disallowEmptySelection
            isDetached
            selectedKeys={[String(activeTab)]}
            onSelectionChange={(keys) => {
              const [key] = keys;
              const step = chapterSteps[Number(key)];
              if (step === undefined) return;
              setManualStep(step);
              chapter.select(step);
            }}
          >
            <motion.span
              className="product-story-tab-indicator"
              aria-hidden="true"
              initial={false}
              animate={{ x: `${activeTab * 100}%` }}
              transition={{ duration: instant ? 0 : 0.35, ease: [0.23, 1, 0.32, 1] }}
            />
            {t.steps.map((title, index) => (
              <ToggleButton key={title} id={String(index)}>
                <span className="product-story-tab-number">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {title}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <div className="product-story-chapter-copy">
            <h3>{t.headings[chapter.active]}</h3>
            <p>{t.notes[chapter.active]}</p>
          </div>
          <ProductStoryStage step={chapter.active} instant={instant} />
          <div className="product-story-bottom">
            <span className="product-story-scroll">
              <UiIcon icon={IconArrowDown} />
              {t.scroll}
            </span>
            <RouteLink className="product-story-action" to="/commerce/smart-variation">
              {t.action}
              <UiIcon icon={IconArrowUpRight} />
            </RouteLink>
          </div>
        </div>
      </div>
    </section>
  );
}

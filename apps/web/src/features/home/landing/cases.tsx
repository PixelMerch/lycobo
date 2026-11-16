import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconArrowUpRight } from "@tabler/icons-react";
import { motion } from "motion/react";
import { RouteLink } from "../../../components/router-link";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { ComparisonBoard } from "./comparison-board";
import { useShowcaseScroll } from "./use-showcase-scroll";

const examples = [
  { id: "studio", reference: "p01-reference", result: "p01-serum-hero" },
  { id: "scene", reference: "p02-blender-hero", result: "p02-kitchen" },
  { id: "apparel", reference: "p11-jacket-mother", result: "p11-worn" },
] as const;

/** 随滚动切换真实商品原图与成片，保留键盘和手动选择。 */
export function Cases() {
  const t = useMessages(commerceShowcaseMessages);
  const chapter = useShowcaseScroll(examples.length);
  const selected = examples[chapter.active] ?? examples[0];
  return (
    <section
      ref={chapter.section}
      className="commerce-comparison commerce-scroll-story"
      aria-labelledby="commerce-results-title"
      data-case={selected.id}
    >
      <div className="commerce-story-sticky">
        <div className="commerce-section commerce-comparison-layout">
          <div className="commerce-comparison-intro">
            <h2 id="commerce-results-title">{t.title}</h2>
            <ToggleButtonGroup
              aria-label={t.examples}
              className="commerce-comparison-tabs"
              disallowEmptySelection
              isDetached
              selectedKeys={[selected.id]}
              selectionMode="single"
              onSelectionChange={(keys) => {
                const [next] = keys;
                const index = examples.findIndex((item) => item.id === next);
                if (index >= 0) chapter.select(index);
              }}
            >
              {examples.map((item) => (
                <ToggleButton id={item.id} key={item.id}>
                  {t.comparisons[item.id].label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <p className="commerce-comparison-note">{t.comparisons[selected.id].description}</p>
            <RouteLink to="/commerce/create" className="commerce-text-link">
              {t.create}
              <UiIcon icon={IconArrowUpRight} />
            </RouteLink>
          </div>

          <motion.div
            key={selected.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="commerce-comparison-stage"
          >
            <ComparisonBoard example={selected} alt={t.comparisons[selected.id].alt} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

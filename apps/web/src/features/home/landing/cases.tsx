import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconArrowUpRight } from "@tabler/icons-react";
import { useState } from "react";
import { RouteLink } from "../../../components/router-link";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { ComparisonBoard } from "./comparison-board";
import { useCommerceScroll } from "./use-commerce-scroll";

const examples = [
  { id: "studio", reference: "p01-reference", result: "p01-serum-hero" },
  { id: "scene", reference: "p02-reference", result: "p02-kitchen" },
  { id: "apparel", reference: "p11-jacket-mother", result: "p11-worn" },
] as const;

/** 原图退至一侧、成片随滚动展开，品类选择始终由用户控制。 */
export function Cases() {
  const t = useMessages(commerceShowcaseMessages);
  const [selected, setSelected] = useState<(typeof examples)[number]>(examples[0]);
  const story = useCommerceScroll();
  const copy = t.comparisons[selected.id];
  return (
    <section
      ref={story.target}
      data-scroll-story={story.enabled}
      className="commerce-scroll-section commerce-comparison"
      aria-labelledby="commerce-results-title"
    >
      <div className="commerce-scroll-pin">
        <div className="commerce-section">
          <div className="commerce-story-heading">
            <h2 id="commerce-results-title">{t.title}</h2>
            <RouteLink className="commerce-text-link" to="/commerce/create">
              {t.create}
              <UiIcon icon={IconArrowUpRight} />
            </RouteLink>
          </div>
          <ToggleButtonGroup
            aria-label={t.examples}
            className="commerce-example-tabs"
            disallowEmptySelection
            isDetached
            selectedKeys={[selected.id]}
            selectionMode="single"
            onSelectionChange={(keys) => {
              const next = examples.find((example) => keys.has(example.id));
              if (next) setSelected(next);
            }}
          >
            {examples.map((example) => (
              <ToggleButton id={example.id} key={example.id}>
                {t.comparisons[example.id].label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <ComparisonBoard example={selected} alt={copy.alt} story={story} />
          <p className="commerce-story-note" aria-live="polite">
            {copy.description}
          </p>
        </div>
      </div>
    </section>
  );
}

import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconArrowRight } from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { RouteLink } from "../../../components/router-link";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";

const examples = [
  { id: "studio", reference: "p01-reference", result: "p01-serum-hero" },
  { id: "scene", reference: "p02-reference", result: "p02-kitchen" },
  { id: "apparel", reference: "p11-jacket-mother", result: "p11-worn" },
] as const;

/** 用并排的商品参考与成片展示三种真实图片用途。 */
export function Cases() {
  const t = useMessages(commerceShowcaseMessages);
  const [selected, setSelected] = useState<(typeof examples)[number]>(examples[0]);
  const reducedMotion = useReducedMotion();
  const copy = t.comparisons[selected.id];
  return (
    <section
      className="commerce-section commerce-comparison"
      aria-labelledby="commerce-results-title"
    >
      <div className="commerce-section-heading">
        <div>
          <h2 id="commerce-results-title">{t.title}</h2>
          <p className="commerce-description">{t.description}</p>
        </div>
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
      <motion.div
        key={selected.id}
        className="commerce-comparison-stage"
        initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <figure className="commerce-reference">
          <img
            src={`/landing/commerce/${selected.reference}.webp`}
            alt={`${t.reference} · ${copy.alt}`}
            loading="lazy"
          />
          <figcaption>{t.reference}</figcaption>
        </figure>
        <div className="commerce-comparison-arrow" aria-hidden="true">
          <UiIcon icon={IconArrowRight} size="action" />
        </div>
        <figure className="commerce-result">
          <img
            src={`/landing/commerce/${selected.result}.webp`}
            alt={`${t.result} · ${copy.alt}`}
            loading="lazy"
          />
          <figcaption>{t.result}</figcaption>
        </figure>
        <div className="commerce-comparison-copy">
          <h3>{copy.title}</h3>
          <p>{copy.description}</p>
          <RouteLink className="commerce-text-link" to="/commerce/create">
            {t.create}
            <UiIcon icon={IconArrowRight} />
          </RouteLink>
        </div>
      </motion.div>
    </section>
  );
}

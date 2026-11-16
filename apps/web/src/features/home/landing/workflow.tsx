import { IconArrowUpRight } from "@tabler/icons-react";
import { motion } from "motion/react";
import { RouteLink } from "../../../components/router-link";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { KitSpecs } from "./kit-specs";

/** 以完整保留画幅的竖版双图参考介绍复制爆款，并直达对应工具。 */
function SpecialistTools() {
  const t = useMessages(commerceShowcaseMessages).tools.replica;
  return (
    <section
      className="commerce-section commerce-specialists"
      aria-labelledby="commerce-replica-title"
    >
      <div className="commerce-specialist">
        <div className="commerce-specialist-media">
          <motion.figure
            className="commerce-specialist-primary"
            initial={{ opacity: 0, y: 28, rotate: -8 }}
            whileInView={{ opacity: 1, y: 0, rotate: -4 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <img src="/landing/commerce/p07-perfume-hero.webp" alt={t.alt} loading="lazy" />
          </motion.figure>
          <motion.figure
            className="commerce-specialist-secondary"
            initial={{ opacity: 0, y: 40, rotate: 8 }}
            whileInView={{ opacity: 1, y: 0, rotate: 4 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <img
              src="/landing/commerce/p10-tableware-hero.webp"
              alt={t.secondaryAlt}
              loading="lazy"
            />
          </motion.figure>
        </div>
        <div className="commerce-specialist-copy">
          <h2 id="commerce-replica-title">{t.title}</h2>
          <p>{t.description}</p>
          <RouteLink to="/commerce/replica" className="commerce-text-link">
            {t.action}
            <UiIcon icon={IconArrowUpRight} />
          </RouteLink>
        </div>
      </div>
    </section>
  );
}

/** 以套图、构图复刻与可操作的输出规格介绍完整图片制作能力。 */
export function Workflow() {
  const t = useMessages(commerceShowcaseMessages).specs;
  return (
    <>
      <SpecialistTools />
      <section className="commerce-output" aria-labelledby="commerce-output-title">
        <div className="commerce-section">
          <div className="commerce-output-heading">
            <h2 id="commerce-output-title">{t.title}</h2>
            <p className="commerce-description">{t.description}</p>
          </div>
          <KitSpecs />
        </div>
      </section>
    </>
  );
}

import { Button } from "@heroui/react";
import { motion } from "motion/react";
import { useRef } from "react";
import { RouteLink } from "../../../components/router-link";
import { useMessages } from "../../../i18n/messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { ProductFrame } from "./product-frame";
import { useCommerceScrollReveal } from "./use-commerce-scroll-reveal";

/** 以同款主图承接创作入口，可回到首屏或直达工作区。 */
export function FinalCta({ onStart }: { onStart: () => void }) {
  const t = useMessages(commerceShowcaseMessages).cta;
  const photo = useRef<HTMLDivElement>(null);
  const reveal = useCommerceScrollReveal(photo, 56, 0.83);
  return (
    <section className="commerce-final" aria-labelledby="commerce-cta-title">
      <div className="commerce-section">
        <div className="commerce-final-panel">
          <div className="commerce-final-copy">
            <h2 id="commerce-cta-title">{t.title}</h2>
            <div className="commerce-final-actions">
              <Button size="lg" className="commerce-primary" onPress={onStart}>
                {t.action}
              </Button>
              <RouteLink to="/workspace" className="commerce-final-secondary">
                {t.workspace}
              </RouteLink>
            </div>
          </div>
          <motion.div ref={photo} style={reveal}>
            <ProductFrame view="studio" className="commerce-final-image" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

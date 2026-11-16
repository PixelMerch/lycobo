import { Button } from "@heroui/react";
import { IconArrowRight } from "@tabler/icons-react";
import { RouteLink } from "../../../components/router-link";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { ProductFrame } from "./product-frame";

/** 以同款主图承接创作入口，可回到首屏或直达工作区。 */
export function FinalCta({ onStart }: { onStart: () => void }) {
  const t = useMessages(commerceShowcaseMessages).cta;
  return (
    <section className="commerce-final" aria-labelledby="commerce-cta-title">
      <div className="commerce-section">
        <div className="commerce-final-panel">
          <div className="commerce-final-copy">
            <h2 id="commerce-cta-title">{t.title}</h2>
            <div className="commerce-final-actions">
              <Button size="lg" className="commerce-primary" onPress={onStart}>
                {t.action}
                <UiIcon icon={IconArrowRight} />
              </Button>
              <RouteLink to="/workspace" className="commerce-final-secondary">
                {t.workspace}
              </RouteLink>
            </div>
          </div>
          <ProductFrame view="studio" className="commerce-final-image" />
        </div>
      </div>
    </section>
  );
}

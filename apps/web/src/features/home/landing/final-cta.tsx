import { Button } from "@heroui/react";
import { IconArrowRight } from "@tabler/icons-react";
import { RouteLink } from "../../../components/router-link";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";

/** 结尾以独立深色行动面板回到首屏创作框，并提供工作区直达入口。 */
export function FinalCta({ onStart }: { onStart: () => void }) {
  const t = useMessages(commerceShowcaseMessages).cta;
  return (
    <section className="commerce-final" aria-labelledby="commerce-cta-title">
      <div className="commerce-section">
        <div className="commerce-final-panel">
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
      </div>
    </section>
  );
}

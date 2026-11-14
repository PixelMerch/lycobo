import { Button } from "@heroui/react";
import { IconArrowRight } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";

/** 结尾以单一创作入口回到首屏，保留用户当前选择的工具。 */
export function FinalCta({ onStart }: { onStart: () => void }) {
  const t = useMessages(commerceShowcaseMessages).cta;
  return (
    <section className="commerce-final" aria-labelledby="commerce-cta-title">
      <div className="commerce-section">
        <h2 id="commerce-cta-title">{t.title}</h2>
        <Button size="lg" className="commerce-primary" onPress={onStart}>
          {t.action}
          <UiIcon icon={IconArrowRight} />
        </Button>
      </div>
    </section>
  );
}

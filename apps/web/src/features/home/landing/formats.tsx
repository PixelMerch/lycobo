import { Button } from "@heroui/react";
import { IconArrowUpRight } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { campaignFormats } from "./commerce-content";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { sectionsMessages } from "./sections-messages";
import { useTemplateRemix } from "./use-template-remix";

/** 静态多品类模板画廊保留真实草稿带入与登录后的继续操作。 */
export function Formats() {
  const remix = useTemplateRemix();
  const t = useMessages(sectionsMessages).formats;
  const heading = useMessages(commerceShowcaseMessages).gallery;
  return (
    <section
      className="commerce-section commerce-gallery"
      id="formats"
      aria-labelledby="commerce-gallery-title"
    >
      <div className="commerce-section-heading">
        <div>
          <h2 id="commerce-gallery-title">{heading.title}</h2>
        </div>
        <p className="commerce-description">{heading.description}</p>
      </div>
      <div className="commerce-gallery-grid">
        {campaignFormats.map((format) => (
          <Button
            variant="ghost"
            className="commerce-template"
            key={format.id}
            aria-label={t.namedAction(t.cards[format.id].title)}
            onPress={() => remix.select(format)}
          >
            <span className="commerce-template-image">
              <img src={format.image} alt="" loading="lazy" />
            </span>
            <span className="commerce-template-caption">
              <span>{t.cards[format.id].title}</span>
              <UiIcon icon={IconArrowUpRight} />
            </span>
          </Button>
        ))}
      </div>
      {remix.dialog}
    </section>
  );
}

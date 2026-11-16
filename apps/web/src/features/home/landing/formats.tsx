import { Button } from "@heroui/react";
import { useMessages } from "../../../i18n/messages";
import { type CampaignFormat, campaignFormats, type FormatId } from "./commerce-content";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { ProductFrame, type ProductView } from "./product-frame";
import { sectionsMessages } from "./sections-messages";
import { useTemplateRemix } from "./use-template-remix";

const exampleViews: Partial<Record<FormatId, ProductView>> = {
  studio: "studio",
  everyday: "scene",
  texture: "detail",
  backgrounds: "alternate",
};

function TemplatePreview({ format }: { format: CampaignFormat }) {
  const view = exampleViews[format.id];
  if (view) return <ProductFrame view={view} className="commerce-template-image" />;
  if (!format.collage) return <span className="commerce-template-image" aria-hidden="true" />;

  return (
    <span className="commerce-template-collage" aria-hidden="true">
      {format.id === "image-set"
        ? (["studio", "scene", "detail"] as const).map((shot) => (
            <ProductFrame key={shot} view={shot} className="commerce-template-cell" />
          ))
        : format.collage.map((src) => <span className="commerce-template-cell" key={src} />)}
    </span>
  );
}

/** 模板使用原生横向滚动，点选整张卡片时沿用现有创作流程。 */
export function Formats() {
  const remix = useTemplateRemix();
  const t = useMessages(sectionsMessages).formats;
  const heading = useMessages(commerceShowcaseMessages).gallery;
  return (
    <section className="commerce-gallery" id="formats" aria-labelledby="commerce-gallery-title">
      <div className="commerce-section commerce-gallery-heading">
        <h2 id="commerce-gallery-title">{heading.title}</h2>
        <p className="commerce-gallery-subtitle">{heading.description}</p>
      </div>
      <div className="commerce-gallery-rail">
        {campaignFormats.map((format) => (
          <Button
            variant="ghost"
            className={
              format.collage ? "commerce-template commerce-template-wide" : "commerce-template"
            }
            key={format.id}
            aria-label={t.namedAction(t.cards[format.id].title)}
            onPress={() => remix.select(format)}
          >
            <TemplatePreview format={format} />
            <span className="commerce-template-caption">{t.cards[format.id].title}</span>
          </Button>
        ))}
      </div>
      {remix.dialog}
    </section>
  );
}

import { Button } from "@heroui/react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { type CampaignFormat, campaignFormats, type FormatId } from "./commerce-content";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { ProductFrame, type ProductView } from "./product-frame";
import { sectionsMessages } from "./sections-messages";
import { useCommerceScrollReveal } from "./use-commerce-scroll-reveal";
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
  const rail = useRef<HTMLDivElement>(null);
  const reveal = useCommerceScrollReveal(rail, 58, 1, "start center");
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    const update = () => {
      const start = element.scrollLeft < 2;
      const end = element.scrollWidth - element.clientWidth - element.scrollLeft < 2;
      setEdges((current) =>
        start === current.start && end === current.end ? current : { start, end },
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, []);

  function turnPage(direction: number) {
    const element = rail.current;
    if (!element) return;
    const style = getComputedStyle(element);
    const pageWidth =
      element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    element.scrollBy({ left: direction * pageWidth });
  }

  return (
    <section className="commerce-gallery" id="formats" aria-labelledby="commerce-gallery-title">
      <div className="commerce-section commerce-gallery-heading">
        <h2 id="commerce-gallery-title">{heading.title}</h2>
        <div className="commerce-gallery-controls">
          <Button
            isIconOnly
            variant="ghost"
            aria-label={heading.previous}
            aria-controls="commerce-gallery-rail"
            isDisabled={edges.start}
            onPress={() => turnPage(-1)}
          >
            <UiIcon icon={IconChevronLeft} />
          </Button>
          <Button
            isIconOnly
            variant="ghost"
            aria-label={heading.next}
            aria-controls="commerce-gallery-rail"
            isDisabled={edges.end}
            onPress={() => turnPage(1)}
          >
            <UiIcon icon={IconChevronRight} />
          </Button>
        </div>
      </div>
      <motion.div
        id="commerce-gallery-rail"
        ref={rail}
        className="commerce-gallery-rail"
        style={reveal}
      >
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
      </motion.div>
      {remix.dialog}
    </section>
  );
}

import { Button } from "@heroui/react";
import {
  IconArrowUpRight,
  IconChevronLeft,
  IconChevronRight,
  IconPlayerPause,
  IconPlayerPlay,
} from "@tabler/icons-react";
import { useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { type CampaignFormat, campaignFormats, type FormatId } from "./commerce-content";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { ProductFrame, type ProductView } from "./product-frame";
import { sectionsMessages } from "./sections-messages";
import { useGalleryAutoplay } from "./use-gallery-autoplay";
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

/** 模板图带默认静止，保留手动浏览、轮播开关和现有创作跳转。 */
export function Formats() {
  const remix = useTemplateRemix();
  const t = useMessages(sectionsMessages).formats;
  const heading = useMessages(commerceShowcaseMessages).gallery;
  const [paused, setPaused] = useState(true);
  const gallery = useGalleryAutoplay(paused);
  return (
    <section className="commerce-gallery" id="formats" aria-labelledby="commerce-gallery-title">
      <div className="commerce-section commerce-section-heading">
        <div className="commerce-gallery-heading">
          <h2 id="commerce-gallery-title">{heading.title}</h2>
          <p className="commerce-gallery-subtitle">{heading.description}</p>
        </div>
        <div className="commerce-gallery-controls">
          {!gallery.reduced && (
            <Button
              isIconOnly
              variant="ghost"
              aria-label={paused ? heading.play : heading.pause}
              onPress={() => setPaused(!paused)}
            >
              <UiIcon icon={paused ? IconPlayerPlay : IconPlayerPause} />
            </Button>
          )}
          <Button
            isIconOnly
            variant="ghost"
            aria-label={heading.previous}
            onPress={() => gallery.move(-1)}
          >
            <UiIcon icon={IconChevronLeft} />
          </Button>
          <Button
            isIconOnly
            variant="ghost"
            aria-label={heading.next}
            onPress={() => gallery.move(1)}
          >
            <UiIcon icon={IconChevronRight} />
          </Button>
        </div>
      </div>
      <section
        ref={gallery.rail}
        aria-label={heading.title}
        className="commerce-gallery-rail"
        onMouseEnter={() => {
          gallery.interaction.current.hovered = true;
        }}
        onMouseLeave={() => {
          gallery.interaction.current.hovered = false;
        }}
        onFocusCapture={() => {
          gallery.interaction.current.focused = true;
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            gallery.interaction.current.focused = false;
        }}
        onPointerDown={() => {
          gallery.interaction.current.dragging = true;
        }}
        onWheel={gallery.hold}
      >
        {(gallery.reduced ? [1] : [0, 1, 2]).map((copy) => (
          <div className="commerce-gallery-group" key={copy} aria-hidden={copy !== 1 || undefined}>
            {campaignFormats.map((format) => (
              <Button
                variant="ghost"
                excludeFromTabOrder={copy !== 1}
                preventFocusOnPress={copy !== 1}
                className={
                  format.collage ? "commerce-template commerce-template-wide" : "commerce-template"
                }
                key={format.id}
                aria-label={t.namedAction(t.cards[format.id].title)}
                onPress={() => remix.select(format)}
              >
                <TemplatePreview format={format} />
                <span className="commerce-template-caption">
                  <span>{t.cards[format.id].title}</span>
                  <UiIcon icon={IconArrowUpRight} />
                </span>
              </Button>
            ))}
          </div>
        ))}
      </section>
      {remix.dialog}
    </section>
  );
}

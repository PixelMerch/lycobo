import { Button } from "@heroui/react";
import {
  IconArrowLeft,
  IconArrowRight,
  IconArrowUpRight,
  IconPlayerPause,
  IconPlayerPlay,
} from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { campaignFormats } from "./commerce-content";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { sectionsMessages } from "./sections-messages";
import { useGalleryAutoplay } from "./use-gallery-autoplay";
import { useTemplateRemix } from "./use-template-remix";

/** 通栏案例图带自动横移，暂停与原生手动浏览保留模板草稿交接。 */
export function Formats() {
  const remix = useTemplateRemix();
  const t = useMessages(sectionsMessages).formats;
  const heading = useMessages(commerceShowcaseMessages).gallery;
  const gallery = useGalleryAutoplay();
  return (
    <section className="commerce-gallery" id="formats" aria-labelledby="commerce-gallery-title">
      <div className="commerce-section commerce-section-heading">
        <h2 id="commerce-gallery-title">{heading.title}</h2>
        <div className="commerce-gallery-controls">
          {!gallery.reduced && (
            <Button
              isIconOnly
              variant="ghost"
              aria-label={gallery.paused ? heading.play : heading.pause}
              onPress={() => gallery.setPaused(!gallery.paused)}
            >
              <UiIcon icon={gallery.paused ? IconPlayerPlay : IconPlayerPause} />
            </Button>
          )}
          <Button
            isIconOnly
            variant="ghost"
            aria-label={heading.previous}
            onPress={() => gallery.move(-1)}
          >
            <UiIcon icon={IconArrowLeft} />
          </Button>
          <Button
            isIconOnly
            variant="ghost"
            aria-label={heading.next}
            onPress={() => gallery.move(1)}
          >
            <UiIcon icon={IconArrowRight} />
          </Button>
        </div>
      </div>
      <section
        ref={gallery.rail}
        aria-label={heading.title}
        className="commerce-gallery-rail"
        onMouseEnter={() => gallery.setEngaged(true)}
        onMouseLeave={() => gallery.setEngaged(false)}
        onFocusCapture={() => gallery.setPaused(true)}
        onPointerDown={() => gallery.setPaused(true)}
        onWheel={() => gallery.setPaused(true)}
      >
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
      </section>
      {remix.dialog}
    </section>
  );
}

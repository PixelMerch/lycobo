import { lazy, Suspense, useState } from "react";
import { useMessages } from "../../../i18n/messages";
import { casesMessages } from "./cases-messages";
import { CommerceBackdrop } from "./commerce-backdrop";
import { caseCards } from "./commerce-content";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { ImageSetBoard } from "./image-set-board";
import { useCommerceScroll } from "./use-commerce-scroll";

const ImageViewer = lazy(async () => {
  const module = await import("../../../components/image-viewer/image-viewer");
  return { default: module.ImageViewer };
});

/** 从穿着主图向两侧展开细节和场景，点击仍可浏览完整服装套图。 */
export function ImageSetFeature() {
  const t = useMessages(commerceShowcaseMessages).set;
  const cases = useMessages(casesMessages);
  const story = useCommerceScroll();
  const [open, setOpen] = useState(false);
  const jacket = caseCards.find((card) => card.id === "jacket");
  const images = [
    { src: "/landing/commerce/p11-worn.webp", alt: cases.cards.jacket.alt },
    ...(jacket?.details ?? []).map((detail) => ({
      src: detail.image,
      alt: cases.detailAlt[detail.id],
    })),
    { src: "/landing/commerce/p11-jacket-mother.webp", alt: cases.referenceAlt },
  ];
  return (
    <section
      ref={story.target}
      data-scroll-story={story.enabled}
      className="commerce-scroll-section commerce-set"
      aria-labelledby="commerce-set-title"
    >
      <div className="commerce-scroll-pin">
        <CommerceBackdrop progress={story.progress} enabled={story.enabled} tone="set" />
        <div className="commerce-section commerce-story-card">
          <div className="commerce-story-heading">
            <h2 id="commerce-set-title">{t.title}</h2>
          </div>
          <ImageSetBoard story={story} onOpen={() => setOpen(true)} />
        </div>
      </div>
      {open && (
        <Suspense fallback={null}>
          <ImageViewer images={images} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </section>
  );
}

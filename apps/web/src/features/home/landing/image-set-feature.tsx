import { lazy, Suspense, useState } from "react";
import { useMessages } from "../../../i18n/messages";
import { casesMessages } from "./cases-messages";
import { caseCards } from "./commerce-content";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { ImageSetBoard } from "./image-set-board";

const ImageViewer = lazy(async () => {
  const module = await import("../../../components/image-viewer/image-viewer");
  return { default: module.ImageViewer };
});

/** 用完整的摄影图组展示服装套图，点击浏览全部八张素材。 */
export function ImageSetFeature() {
  const t = useMessages(commerceShowcaseMessages).set;
  const cases = useMessages(casesMessages);
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
    <section className="commerce-set" aria-labelledby="commerce-set-title">
      <div className="commerce-section">
        <div className="commerce-story-heading">
          <h2 id="commerce-set-title">{t.title}</h2>
        </div>
        <ImageSetBoard onOpen={() => setOpen(true)} />
      </div>
      {open && (
        <Suspense fallback={null}>
          <ImageViewer images={images} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </section>
  );
}

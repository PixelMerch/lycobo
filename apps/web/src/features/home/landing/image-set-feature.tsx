import { IconArrowUpRight } from "@tabler/icons-react";
import { lazy, Suspense, useState } from "react";
import { RouteLink } from "../../../components/router-link";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { casesMessages } from "./cases-messages";
import { commerceShowcaseMessages } from "./commerce-showcase-messages";
import { ImageSetBoard } from "./image-set-board";
import { textileFeatureMessages } from "./textile-feature-messages";

const ImageViewer = lazy(async () => {
  const module = await import("../../../components/image-viewer/image-viewer");
  return { default: module.ImageViewer };
});

/** 使用项目已有的同款家纺或外套素材呈现套图，并保留真实创作与放大入口。 */
export function ImageSetFeature({ apparel }: { apparel: boolean }) {
  const t = useMessages(commerceShowcaseMessages).set;
  const cases = useMessages(casesMessages);
  const textile = useMessages(textileFeatureMessages);
  const [open, setOpen] = useState(false);
  const images = apparel
    ? [
        { src: "/landing/commerce/p11-worn.webp", alt: t.full },
        { src: "/landing/commerce/p11-zipper.webp", alt: t.zipper },
        { src: "/landing/commerce/p11-fabric.webp", alt: t.fabric },
        { src: "/landing/commerce/p11-scene.webp", alt: t.scene },
      ]
    : (["front", "pillow", "fabric", "bed-end"] as const).map((view) => ({
        src: `/studio/textile-views/${view}.webp`,
        alt: textile.views[view].title,
      }));
  const viewerImages = apparel
    ? [
        ...images,
        ...(["collar", "cuff", "pocket"] as const).map((view) => ({
          src: `/landing/commerce/p11-${view}.webp`,
          alt: cases.detailAlt[view],
        })),
        { src: "/landing/commerce/p11-jacket-mother.webp", alt: cases.referenceAlt },
      ]
    : images;
  return (
    <>
      <ImageSetBoard
        key={String(apparel)}
        images={images}
        label={apparel ? t.open : textile.open}
        onOpen={() => setOpen(true)}
      />
      <RouteLink
        to={apparel ? "/commerce/smart-variation" : "/commerce/textile-set"}
        className="commerce-set-link"
      >
        {apparel ? t.action : textile.action}
        <UiIcon icon={IconArrowUpRight} />
      </RouteLink>
      {open && (
        <Suspense fallback={null}>
          <ImageViewer images={viewerImages} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}

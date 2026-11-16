import { Button } from "@heroui/react";
import { lazy, Suspense, useState } from "react";
import { useMessages } from "../../../i18n/messages";
import { textileFeatureMessages } from "./textile-feature-messages";

const views = ["front", "pillow", "fabric", "bed-end"] as const;
const ImageViewer = lazy(async () => {
  const module = await import("../../../components/image-viewer/image-viewer");
  return { default: module.ImageViewer };
});

/** 家纺以整幅卧室照片与三张细节构成展页，所有视角可直接打开浏览。 */
export function TextileFeature() {
  const t = useMessages(textileFeatureMessages);
  const [viewerStart, setViewerStart] = useState<(typeof views)[number] | null>(null);
  const images = [
    viewerStart ?? "front",
    ...views.filter((view) => view !== (viewerStart ?? "front")),
  ].map((view) => ({ src: `/studio/textile-views/${view}.webp`, alt: t.views[view].title }));
  return (
    <section className="commerce-textile" aria-labelledby="commerce-textile-title">
      <div className="commerce-section commerce-textile-layout">
        <div className="commerce-textile-heading">
          <h2 id="commerce-textile-title">{t.title}</h2>
        </div>
        {views.map((view) => (
          <Button
            key={view}
            className={`commerce-textile-view commerce-textile-view-${view}`}
            variant="ghost"
            onPress={() => setViewerStart(view)}
            aria-label={`${t.open} · ${t.views[view].title}`}
          >
            <img
              src={`/studio/textile-views/${view}.webp`}
              alt={t.views[view].title}
              loading="lazy"
            />
          </Button>
        ))}
      </div>
      {viewerStart && (
        <Suspense fallback={null}>
          <ImageViewer images={images} onClose={() => setViewerStart(null)} />
        </Suspense>
      )}
    </section>
  );
}

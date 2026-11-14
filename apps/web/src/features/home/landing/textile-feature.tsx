import { Button } from "@heroui/react";
import { lazy, Suspense, useState } from "react";
import { useMessages } from "../../../i18n/messages";
import { CommerceBackdrop } from "./commerce-backdrop";
import { textileFeatureMessages } from "./textile-feature-messages";
import { TextileScrollBoard } from "./textile-scroll-board";
import { useCommerceScroll } from "./use-commerce-scroll";
import { useScrollChapter } from "./use-scroll-chapter";

const views = ["front", "pillow", "fabric", "bed-end"] as const;
const thresholds = [0.26, 0.5, 0.74] as const;
const ImageViewer = lazy(async () => {
  const module = await import("../../../components/image-viewer/image-viewer");
  return { default: module.ImageViewer };
});

/** 家纺主视角由滚动推进；静态模式直接列出四张照片，不依赖手动页签。 */
export function TextileFeature() {
  const t = useMessages(textileFeatureMessages);
  const story = useCommerceScroll();
  const chapter = useScrollChapter(story.progress, thresholds);
  const selected = views[chapter] ?? "front";
  const [viewerStart, setViewerStart] = useState<(typeof views)[number] | null>(null);
  const images = [
    viewerStart ?? selected,
    ...views.filter((view) => view !== (viewerStart ?? selected)),
  ].map((view) => ({ src: `/studio/textile-views/${view}.webp`, alt: t.views[view].title }));
  return (
    <section
      ref={story.target}
      data-scroll-story={story.enabled}
      className="commerce-textile"
      aria-labelledby="commerce-textile-title"
    >
      <div className="commerce-textile-pin">
        <CommerceBackdrop progress={story.progress} enabled={story.enabled} tone="textile" />
        <div className="commerce-section commerce-story-card">
          <div className="commerce-textile-heading">
            <h2 id="commerce-textile-title">{t.title}</h2>
          </div>
          {story.enabled ? (
            <TextileScrollBoard
              selected={selected}
              onOpen={() => setViewerStart(selected)}
              progress={story.progress}
            />
          ) : (
            <div className="commerce-textile-static">
              {views.map((view) => (
                <Button
                  key={view}
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
          )}
        </div>
      </div>
      {viewerStart && (
        <Suspense fallback={null}>
          <ImageViewer images={images} onClose={() => setViewerStart(null)} />
        </Suspense>
      )}
    </section>
  );
}

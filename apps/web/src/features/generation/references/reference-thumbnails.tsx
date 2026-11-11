import { Button } from "@heroui/react";
import { lazy, Suspense, useRef, useState } from "react";
import { useMessages } from "../../../i18n/messages";
import { AssetImage } from "../asset-image";
import { assetContentUrl } from "../generation-client";
import { referencesMessages } from "./references-messages";

const ImageViewer = lazy(() =>
  import("../../../components/image-viewer/image-viewer").then((module) => ({
    default: module.ImageViewer,
  })),
);

/** 任务参考图缩略图：点开后在共享查看器里定位到这一张。 */
export function ReferenceThumbnails({
  ids,
  label,
  itemLabel,
}: {
  ids: string[];
  label?: string;
  itemLabel?: string;
}) {
  const [preview, setPreview] = useState<number | null>(null);
  const t = useMessages(referencesMessages);
  const item = itemLabel ?? t.referenceImage;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  if (ids.length === 0) return null;
  return (
    <section className="generation-output-thumbnails" aria-label={label}>
      {ids.map((id, index) => (
        <Button
          variant="ghost"
          ref={(element) => {
            buttons.current[index] = element;
          }}
          key={id}
          className="generation-output-thumbnail"
          onPress={() => {
            buttons.current[index]?.focus();
            setPreview(index);
          }}
          aria-label={t.viewItem(item, index + 1)}
        >
          <AssetImage
            assetId={id}
            thumbnail
            alt={t.itemThumbnail(item, index + 1)}
            loading="lazy"
          />
        </Button>
      ))}
      {preview !== null && (
        <Suspense fallback={null}>
          <ImageViewer
            images={ids.map((id, index) => ({
              src: assetContentUrl(id),
              thumbnailSrc: assetContentUrl(id, true),
              alt: `${itemLabel} ${index + 1}`,
            }))}
            initialIndex={preview}
            onClose={() => setPreview(null)}
          />
        </Suspense>
      )}
    </section>
  );
}

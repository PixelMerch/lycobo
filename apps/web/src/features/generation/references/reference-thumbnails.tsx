import { Button } from "@heroui/react";
import { lazy, Suspense, useRef, useState } from "react";
import { AssetImage } from "../asset-image";
import { assetContentUrl } from "../generation-client";

const ImageViewer = lazy(() =>
  import("../../../components/image-viewer").then((module) => ({ default: module.ImageViewer })),
);

/** Task references open the shared viewer at their position in this reference set. */
export function ReferenceThumbnails({
  ids,
  label,
  itemLabel = "参考图片",
}: {
  ids: string[];
  label?: string;
  itemLabel?: string;
}) {
  const [preview, setPreview] = useState<number | null>(null);
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
          aria-label={`查看${itemLabel} ${index + 1}`}
        >
          <AssetImage
            assetId={id}
            thumbnail
            alt={`${itemLabel} ${index + 1} 缩略图`}
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

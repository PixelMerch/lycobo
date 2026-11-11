import { Button } from "@heroui/react";
import { IconClock, IconPhotoOff } from "@tabler/icons-react";
import { lazy, Suspense, useRef, useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
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
  pendingIds,
  label,
  itemLabel,
}: {
  ids: string[];
  pendingIds?: string[] | undefined;
  label?: string;
  itemLabel?: string;
}) {
  const [preview, setPreview] = useState<{ ids: string[]; index: number } | null>(null);
  const t = useMessages(referencesMessages);
  const item = itemLabel ?? t.referenceImage;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  if (ids.length === 0) return null;
  return (
    <section className="generation-output-thumbnails" aria-label={label}>
      {ids.map((id, index) =>
        pendingIds?.includes(id) ? (
          <span className="generation-output-thumbnail reference-thumbnail-placeholder" key={id}>
            <UiIcon icon={IconClock} />
            <span>{t.thumbnailProcessing}</span>
          </span>
        ) : (
          <Button
            variant="ghost"
            ref={(element) => {
              buttons.current[index] = element;
            }}
            key={id}
            className="generation-output-thumbnail"
            onPress={() => {
              buttons.current[index]?.focus();
              const readyIds = ids.filter((assetId) => !pendingIds?.includes(assetId));
              setPreview({ ids: readyIds, index: readyIds.indexOf(id) });
            }}
            aria-label={t.viewItem(item, index + 1)}
          >
            <AssetImage
              assetId={id}
              thumbnail
              alt={t.itemThumbnail(item, index + 1)}
              loading="lazy"
              fallback={
                <span className="reference-thumbnail-placeholder">
                  <UiIcon icon={IconPhotoOff} />
                  <span>{t.thumbnailUnavailable}</span>
                </span>
              }
            />
          </Button>
        ),
      )}
      {preview !== null && (
        <Suspense fallback={null}>
          <ImageViewer
            images={preview.ids.map((id) => ({
              src: assetContentUrl(id),
              thumbnailSrc: assetContentUrl(id, true),
              alt: t.itemThumbnail(item, ids.indexOf(id) + 1),
            }))}
            initialIndex={preview.index}
            onClose={() => setPreview(null)}
          />
        </Suspense>
      )}
    </section>
  );
}

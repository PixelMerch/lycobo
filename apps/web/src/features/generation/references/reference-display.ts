import { assetContentUrl } from "../asset-delivery-client";
import type { ReferenceImage } from "../studio-state";

export function referenceDisplaySource(image: ReferenceImage, thumbnail = false) {
  if (image.assetId) return assetContentUrl(image.assetId, thumbnail);
  return thumbnail
    ? (image.thumbnailSrc ?? image.previewSrc ?? image.src)
    : (image.previewSrc ?? image.src);
}

import type { ImageAsset } from "@lycoboai/contracts";
import { ImagePreviewDialog } from "../image-workspace/image-preview";
import type { useAssetLibrary } from "./asset-library-client";

const toPreview = (asset: ImageAsset) => ({
  id: asset.id,
  publicId: asset.public_id,
  width: asset.width,
  height: asset.height,
  meta: {
    taskPublicId: asset.task_public_id,
    model: asset.model,
    createdAt: asset.created_at,
    prompt: asset.prompt,
    imagePublicId: asset.public_id,
  },
});

/** 在素材库预览图片，并按需加载后续图片。 */
export function AssetPreview({
  assets,
  index,
  query,
  onClose,
  onViewHistory,
}: {
  assets: ImageAsset[];
  index: number;
  query: ReturnType<typeof useAssetLibrary>;
  onClose: () => void;
  onViewHistory: (() => void) | undefined;
}) {
  return (
    <ImagePreviewDialog
      images={assets.map(toPreview)}
      initialIndex={index}
      onClose={onClose}
      hasMore={query.hasNextPage}
      isLoadingMore={query.isFetchingNextPage}
      isLoadMoreError={query.isError}
      onLoadMore={() => query.fetchNextPage({ cancelRefetch: false })}
      {...(onViewHistory ? { onViewHistory } : {})}
    />
  );
}

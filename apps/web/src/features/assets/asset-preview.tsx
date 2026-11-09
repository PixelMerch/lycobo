import type { ImageAsset } from "@lycoboai/contracts";
import { ImagePreviewDialog } from "../image-workspace/image-preview";
import { VideoPlayerDialog } from "../video/player/video-player-dialog";
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
const toPreviewVideo = (asset: ImageAsset) => {
  const sized = asset.width > 0 && asset.height > 0;
  return {
    id: asset.id,
    aspect: sized ? asset.width / asset.height : 9 / 16,
    seconds: asset.duration_seconds ?? undefined,
    taskPublicId: asset.task_public_id,
    createdAt: asset.created_at,
    prompt: asset.prompt,
    params: [
      ...(sized ? [{ label: "尺寸", value: `${asset.width}×${asset.height}` }] : []),
      ...(asset.duration_seconds ? [{ label: "时长", value: `${asset.duration_seconds}秒` }] : []),
      ...(asset.resolution ? [{ label: "清晰度", value: asset.resolution }] : []),
    ],
  };
};

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
  const asset = assets[index];
  if (asset?.type === "video")
    return (
      <VideoPlayerDialog
        videos={assets.filter((asset) => asset.type === "video").map(toPreviewVideo)}
        initialId={asset.id}
        onClose={onClose}
        hasMore={query.hasNextPage}
        isLoadingMore={query.isFetchingNextPage}
        isLoadMoreError={query.isError}
        onLoadMore={() => query.fetchNextPage({ cancelRefetch: false })}
      />
    );
  const images = assets.filter((image) => image.type === "image");
  return (
    <ImagePreviewDialog
      images={images.map(toPreview)}
      initialIndex={Math.max(
        0,
        images.findIndex((image) => image.id === asset?.id),
      )}
      onClose={onClose}
      hasMore={query.hasNextPage}
      isLoadingMore={query.isFetchingNextPage}
      isLoadMoreError={query.isError}
      onLoadMore={() => query.fetchNextPage({ cancelRefetch: false })}
      {...(onViewHistory ? { onViewHistory } : {})}
    />
  );
}

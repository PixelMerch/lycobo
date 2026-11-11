import type { ImageJob } from "@lycoboai/contracts";
import { ImagePreviewDialog, type PreviewImage } from "../../image-workspace/image-preview";
import { useImageHistory } from "../generation-client";

export function historyPreviewImages(jobs: ImageJob[]): PreviewImage[] {
  return jobs.flatMap((job) =>
    job.items.flatMap((item) =>
      item.status === "succeeded" && item.output_asset_id
        ? [
            {
              id: item.output_asset_id,
              publicId: item.output_public_id,
              width: item.width,
              height: item.height,
              meta: {
                taskPublicId: job.public_id,
                model: job.model,
                createdAt: job.created_at,
                prompt: job.prompt,
                references: job.input?.referenceAssetIds ?? [],
              },
            },
          ]
        : [],
    ),
  );
}

/** 实时事件更新历史缓存时保持已打开的图片预览稳定。 */
export function HistoryImagePreview({
  images: initialImages,
  assetId,
  onClose,
  tool = "create",
}: {
  images: PreviewImage[];
  tool?: "create" | "textile" | "variation" | "replica" | "all";
  assetId: string;
  onClose: () => void;
}) {
  const query = useImageHistory(tool);
  const ids = new Set(initialImages.map((image) => image.id));
  const fetched = historyPreviewImages(query.data?.pages.flatMap((page) => page.data) ?? []);
  const images = [...initialImages, ...fetched.filter((image) => !ids.has(image.id))];
  const loadMore = () => query.fetchNextPage({ cancelRefetch: false });
  return (
    <ImagePreviewDialog
      images={images}
      initialIndex={Math.max(
        0,
        initialImages.findIndex((image) => image.id === assetId),
      )}
      hasMore={query.hasNextPage}
      isLoadingMore={query.isFetchingNextPage}
      isLoadMoreError={query.isError}
      onLoadMore={loadMore}
      onClose={onClose}
    />
  );
}

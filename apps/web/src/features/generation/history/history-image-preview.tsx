import type { ImageJob } from "@lycoboai/contracts";
import { useState } from "react";
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

/** Keep the open gallery stable while SSE updates the shared history cache. */
export function HistoryImagePreview({
  images: initialImages,
  assetId,
  onClose,
}: {
  images: PreviewImage[];
  assetId: string;
  onClose: () => void;
}) {
  const query = useImageHistory({ poll: false });
  const [images, setImages] = useState(initialImages);
  const loadMore = async () => {
    const result = await query.fetchNextPage({ cancelRefetch: false });
    const fetched = historyPreviewImages(result.data?.pages.flatMap((page) => page.data) ?? []);
    setImages((current) => {
      const ids = new Set(current.map((image) => image.id));
      return [...current, ...fetched.filter((image) => !ids.has(image.id))];
    });
  };
  return (
    <ImagePreviewDialog
      images={images}
      initialIndex={Math.max(
        0,
        initialImages.findIndex((image) => image.id === assetId),
      )}
      hasMore={query.hasNextPage}
      isLoadingMore={query.isFetchingNextPage}
      onLoadMore={() => void loadMore()}
      onClose={onClose}
    />
  );
}

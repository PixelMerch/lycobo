import type { VideoTask } from "@lycoboai/contracts";
import { useVideoTasks } from "./video-client";
import { type PreviewVideo, VideoPlayerDialog } from "./video-player-dialog";

function previewVideos(task: VideoTask): PreviewVideo[] {
  if (!task.asset_id || !task.delivery) return [];
  const { aspectRatio, seconds, referenceAssetIds } = task.input.video;
  const [width, height] = aspectRatio.split(":").map(Number);
  return [
    {
      id: task.asset_id,
      aspect: width && height ? width / height : 9 / 16,
      seconds,
      taskPublicId: task.public_id,
      createdAt: task.created_at,
      prompt: task.prompt,
      references: referenceAssetIds,
      params: [
        { label: "画面比例", value: aspectRatio },
        { label: "时长", value: `${seconds}秒` },
        { label: "清晰度", value: "768p" },
      ],
    },
  ];
}

/** The rail pages through the same history as the list behind the dialog. */
export function VideoHistoryPreview({
  assetId,
  onClose,
}: {
  assetId: string;
  onClose: () => void;
}) {
  const query = useVideoTasks();
  return (
    <VideoPlayerDialog
      videos={query.data?.pages.flatMap((page) => page.data).flatMap(previewVideos) ?? []}
      initialId={assetId}
      hasMore={query.hasNextPage}
      isLoadingMore={query.isFetchingNextPage}
      isLoadMoreError={query.isError}
      onLoadMore={() => query.fetchNextPage({ cancelRefetch: false })}
      onClose={onClose}
    />
  );
}

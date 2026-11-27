import type { VideoTask } from "@lycoboai/contracts";
import { currentMessages } from "../../../i18n/messages";
import { type PreviewVideo, VideoPlayerDialog } from "../player/video-player-dialog";
import { useVideoTasks } from "../video-client";
import { videoHistoryMessages } from "./video-history-messages";

function previewVideos(task: VideoTask): PreviewVideo[] {
  if (!task.asset_id || !task.delivery) return [];
  const t = currentMessages(videoHistoryMessages);
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
        { label: t.aspectRatio, value: aspectRatio },
        { label: t.duration, value: t.seconds(seconds) },
        { label: t.clarity, value: "768p" },
      ],
    },
  ];
}

/** 视频预览侧栏与背后的历史列表共用分页数据。 */
export function VideoHistoryPreview({
  assetId,
  onClose,
}: {
  assetId: string;
  onClose: () => void;
}) {
  const { query } = useVideoTasks();
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

import { Button, EmptyState, Spinner } from "@heroui/react";
import { IconChevronRight, IconMovie } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { InfiniteLoad } from "../../../components/infinite-load";
import { UiIcon } from "../../../components/ui-icon";
import { useErrorToast } from "../../../lib/error-toast";
import { LibraryDialog } from "../../assets/library-dialog";
import { AssetImage } from "../../generation/asset-image";
import { historyContentTop } from "../../generation/history/history-navigation";
import { VideoProductionCard, videoProductionCardId } from "../production/video-production-card";
import type { Production } from "../production/video-production-progress";
import { useVideoTasks } from "../video-client";
import { VideoTaskCard } from "./video-task-card";
import { isVideoTaskActive } from "./video-task-status";

export function VideoHistory({
  onRestore,
  production,
}: {
  onRestore: () => void;
  production?: Production;
}) {
  const query = useVideoTasks();
  useErrorToast(query.error?.message);
  const tasks = query.data?.pages.flatMap((page) => page.data) ?? [];
  const client = useQueryClient();
  const settled = tasks
    .filter((task) => task.status === "succeeded" || task.status === "failed")
    .map((task) => `${task.id}:${task.status}`)
    .join("|");
  // Provider completions arrive through polling; synchronize the shared wallet and asset cache.
  useEffect(() => {
    if (!settled) return;
    void client.invalidateQueries({ queryKey: ["wallet"] });
    void client.invalidateQueries({ queryKey: ["wallet-entries"] });
    void client.invalidateQueries({ queryKey: ["image-assets"] });
  }, [settled, client]);
  const videoId = production?.draft.progress.acceptedVideoId;
  // A run is one history entry. It stays a local card until its task reaches this list, which
  // the refetch after acceptance takes a moment to do; a task no longer listed drops the card.
  const unlisted = !tasks.some((task) => task.id === videoId);
  const productionCard =
    production &&
    unlisted &&
    (production.busy || production.needsResume || (videoId && query.isFetching)) ? (
      <VideoProductionCard production={production} />
    ) : null;
  if (query.isLoading && !productionCard) return <Spinner aria-label="正在加载视频历史" />;
  if (query.isError && !query.data)
    return (
      <>
        {productionCard && (
          <div className="generation-history video-history-list">{productionCard}</div>
        )}
        <EmptyState>
          <p>视频历史暂不可用</p>
          <Button onPress={() => void query.refetch()}>重试</Button>
        </EmptyState>
      </>
    );
  if (!tasks.length && !productionCard)
    return (
      <EmptyState className="empty-state generation-empty-state">
        <UiIcon icon={IconMovie} size="illustration" />
        <p>生成的视频会显示在这里</p>
      </EmptyState>
    );
  return (
    <div className="generation-history video-history-list">
      {productionCard}
      {tasks.map((task) => (
        <VideoTaskCard
          key={task.id}
          task={task}
          onRestore={onRestore}
          production={task.id === videoId && isVideoTaskActive(task) ? production : undefined}
        />
      ))}
      <InfiniteLoad
        hasMore={query.hasNextPage}
        isLoading={query.isFetchingNextPage}
        isError={query.isError}
        onLoadMore={() => query.fetchNextPage({ cancelRefetch: false })}
      />
    </div>
  );
}
export function VideoHistoryRail({ production }: { production: Production }) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const query = useVideoTasks();
  const tasks = query.data?.pages.flatMap((page) => page.data) ?? [];
  const producing =
    !production.draft.progress.acceptedVideoId && (production.busy || production.needsResume);
  const entryIds = [
    ...(producing ? [videoProductionCardId] : []),
    ...tasks.map(({ id }) => `video-task-${id}`),
  ];
  const currentId = entryIds.includes(activeId ?? "") ? activeId : entryIds[0];
  const locate = (id: string) => {
    setActiveId(id);
    const target = document.getElementById(id);
    if (target)
      window.scrollTo({
        top: Math.max(0, window.scrollY + target.getBoundingClientRect().top - historyContentTop()),
        behavior: "instant",
      });
  };
  return (
    <>
      <aside className="history-rail" aria-label="视频历史索引">
        <h2 className="history-rail-title">
          <Button
            variant="tertiary"
            className="history-rail-open"
            aria-label="打开素材库"
            onPress={() => setLibraryOpen(true)}
          >
            <span>我的素材</span>
            <UiIcon icon={IconChevronRight} size="small" />
          </Button>
        </h2>
        <div className="history-rail-list">
          {producing && (
            <div className="history-rail-item">
              <Button
                variant="tertiary"
                className={`history-thumbnail${production.busy ? " generation-pending" : ""}`}
                aria-label="定位正在制作的视频"
                aria-current={currentId === videoProductionCardId ? "true" : "false"}
                onPress={() => locate(videoProductionCardId)}
              >
                {production.busy ? (
                  <span className="history-thumbnail-frame">
                    <Spinner size="sm" aria-label="视频处理中" />
                  </span>
                ) : (
                  <UiIcon icon={IconMovie} size="action" />
                )}
              </Button>
            </div>
          )}
          {tasks.map((task) => (
            <div className="history-rail-item" key={task.id}>
              <Button
                variant="tertiary"
                className={`history-thumbnail${isVideoTaskActive(task) ? " generation-pending" : ""}`}
                aria-label={`定位视频：${task.public_id}`}
                aria-current={currentId === `video-task-${task.id}` ? "true" : "false"}
                onPress={() => locate(`video-task-${task.id}`)}
              >
                <VideoTaskThumbnail task={task} />
              </Button>
            </div>
          ))}
        </div>
      </aside>
      {libraryOpen && <LibraryDialog tool="video" onClose={() => setLibraryOpen(false)} />}
    </>
  );
}

function VideoTaskThumbnail({ task }: { task: Parameters<typeof isVideoTaskActive>[0] }) {
  if (task.asset_id)
    return (
      <span className="history-thumbnail-frame">
        <AssetImage
          assetId={task.asset_id}
          thumbnail
          alt={`视频 ${task.public_id} 封面`}
          loading="lazy"
        />
      </span>
    );
  if (isVideoTaskActive(task))
    return (
      <span className="history-thumbnail-frame">
        <Spinner size="sm" aria-label="视频处理中" />
      </span>
    );
  return <UiIcon icon={IconMovie} size="action" />;
}

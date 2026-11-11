import { Button, EmptyState, Spinner } from "@heroui/react";
import { IconChevronRight, IconMovie } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { InfiniteLoad } from "../../../components/infinite-load";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { useErrorToast } from "../../../lib/error-toast";
import { LibraryDialog } from "../../assets/library-dialog";
import { AssetImage } from "../../generation/asset-image";
import { historyContentTop } from "../../generation/history/history-navigation";
import { VideoProductionCard, videoProductionCardId } from "../production/video-production-card";
import type { Production } from "../production/video-production-progress";
import { useVideoTasks } from "../video-client";
import { videoHistoryMessages } from "./video-history-messages";
import { VideoTaskCard } from "./video-task-card";
import { isVideoTaskActive } from "./video-task-status";

/** 视频历史列表：正在制作的视频卡与已提交的视频任务。 */
export function VideoHistory({
  onRestore,
  production,
}: {
  onRestore: () => void;
  production?: Production;
}) {
  const t = useMessages(videoHistoryMessages);
  const query = useVideoTasks();
  useErrorToast(query.error?.message);
  const tasks = query.data?.pages.flatMap((page) => page.data) ?? [];
  const client = useQueryClient();
  const settled = tasks
    .filter((task) => task.status === "succeeded" || task.status === "failed")
    .map((task) => `${task.id}:${task.status}`)
    .join("|");
  // 供应商的完成状态靠轮询得到，完成后同步刷新共享的余额与素材缓存。
  useEffect(() => {
    if (!settled) return;
    void client.invalidateQueries({ queryKey: ["wallet"] });
    void client.invalidateQueries({ queryKey: ["wallet-entries"] });
    void client.invalidateQueries({ queryKey: ["image-assets"] });
  }, [settled, client]);
  const videoId = production?.draft.progress.acceptedVideoId;
  // 一次制作就是一条历史；任务进入列表前先显示本地制作卡，接受后的重新查询需要一点时间。
  // 列表里不再有这条任务时去掉制作卡。
  const unlisted = !tasks.some((task) => task.id === videoId);
  const productionCard =
    production &&
    unlisted &&
    (production.busy || production.needsResume || (videoId && query.isFetching)) ? (
      <VideoProductionCard production={production} />
    ) : null;
  if (query.isLoading && !productionCard) return <Spinner aria-label={t.loading} />;
  if (query.isError && !query.data)
    return (
      <>
        {productionCard && (
          <div className="generation-history video-history-list">{productionCard}</div>
        )}
        <EmptyState>
          <p>{t.unavailable}</p>
          <Button onPress={() => void query.refetch()}>{t.retry}</Button>
        </EmptyState>
      </>
    );
  if (!tasks.length && !productionCard)
    return (
      <EmptyState className="empty-state generation-empty-state">
        <UiIcon icon={IconMovie} size="illustration" />
        <p>{t.empty}</p>
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
/** 视频历史索引栏：定位正在制作的视频和已有任务，打开素材库。 */
export function VideoHistoryRail({ production }: { production: Production }) {
  const t = useMessages(videoHistoryMessages);
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
      <aside className="history-rail" aria-label={t.rail}>
        <h2 className="history-rail-title">
          <Button
            variant="tertiary"
            className="history-rail-open"
            aria-label={t.openLibrary}
            onPress={() => setLibraryOpen(true)}
          >
            <span>{t.myAssets}</span>
            <UiIcon icon={IconChevronRight} size="small" />
          </Button>
        </h2>
        <div className="history-rail-list">
          {producing && (
            <div className="history-rail-item">
              <Button
                variant="tertiary"
                className={`history-thumbnail${production.busy ? " generation-pending" : ""}`}
                aria-label={t.locateProduction}
                aria-current={currentId === videoProductionCardId ? "true" : "false"}
                onPress={() => locate(videoProductionCardId)}
              >
                {production.busy ? (
                  <span className="history-thumbnail-frame">
                    <Spinner size="sm" aria-label={t.processing} />
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
                aria-label={t.locateVideo(task.public_id)}
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
  const t = useMessages(videoHistoryMessages);
  if (task.asset_id)
    return (
      <span className="history-thumbnail-frame">
        <AssetImage
          assetId={task.asset_id}
          thumbnail
          alt={t.videoCover(task.public_id)}
          loading="lazy"
        />
      </span>
    );
  if (isVideoTaskActive(task))
    return (
      <span className="history-thumbnail-frame">
        <Spinner size="sm" aria-label={t.processing} />
      </span>
    );
  return <UiIcon icon={IconMovie} size="action" />;
}

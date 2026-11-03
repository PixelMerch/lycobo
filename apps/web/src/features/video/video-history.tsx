import { Button, EmptyState, Link, Spinner } from "@heroui/react";
import { IconChevronRight, IconMovie } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { InfiniteLoad } from "../../components/infinite-load";
import { UiIcon } from "../../components/ui-icon";
import { useErrorToast } from "../../lib/error-toast";
import { LibraryDialog } from "../assets/library-dialog";
import { useVideoTasks } from "./video-client";

const statusText = {
  queued: "排队中",
  running: "生成中",
  succeeded: "已完成",
  failed: "生成失败，积分已退回",
  needs_reconciliation: "结果待核对，请勿重复提交",
};
export function VideoHistory() {
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
  if (query.isLoading) return <Spinner aria-label="正在加载视频历史" />;
  if (query.isError && !query.data)
    return (
      <EmptyState>
        <p>视频历史暂不可用</p>
        <Button onPress={() => void query.refetch()}>重试</Button>
      </EmptyState>
    );
  if (!tasks.length)
    return (
      <EmptyState className="empty-state generation-empty-state">
        <UiIcon icon={IconMovie} size="illustration" />
        <p>生成的视频会显示在这里</p>
      </EmptyState>
    );
  return (
    <div className="video-history-list">
      {tasks.map((task) => (
        <article
          key={task.id}
          id={`video-task-${task.id}`}
          className="video-history-card"
          aria-label={`视频任务：${task.public_id}`}
        >
          <div className="video-history-meta">
            <span>
              {task.public_id} · {task.input.video.seconds}秒 · 768p
            </span>
            <span>
              {task.status === "running" && task.provider_status === "paused"
                ? "任务暂停，等待恢复"
                : task.status === "running" && task.provider_status === "pending_confirmation"
                  ? "结果待确认，请勿重复提交"
                  : task.status === "running" && task.provider_status === "completed"
                    ? "正在保存视频"
                    : statusText[task.status]}
            </span>
          </div>
          <p>{task.prompt}</p>
          {task.status === "running" && <Spinner size="sm" aria-label="视频生成中" />}
          {task.delivery && (
            <>
              {/* biome-ignore lint/a11y/useMediaCaption: generated videos have no subtitle-track metadata. */}
              <video
                controls
                playsInline
                preload="none"
                src={task.delivery.url}
                aria-label={`视频：${task.public_id}`}
              />
              <Link href={task.delivery.download_url} download>
                下载视频
              </Link>
            </>
          )}
        </article>
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
export function VideoHistoryRail() {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const query = useVideoTasks();
  const tasks = query.data?.pages.flatMap((page) => page.data) ?? [];
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
          {tasks.map((task) => (
            <Button
              key={task.id}
              variant="ghost"
              aria-label={`定位视频：${task.public_id}`}
              onPress={() =>
                document
                  .getElementById(`video-task-${task.id}`)
                  ?.scrollIntoView({ block: "start", behavior: "auto" })
              }
            >
              <UiIcon icon={IconMovie} />
              <span>{task.public_id}</span>
            </Button>
          ))}
        </div>
      </aside>
      {libraryOpen && <LibraryDialog tool="video" onClose={() => setLibraryOpen(false)} />}
    </>
  );
}

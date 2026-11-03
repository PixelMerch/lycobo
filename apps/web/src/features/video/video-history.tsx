import { Button, EmptyState, Spinner } from "@heroui/react";
import { IconChevronRight, IconMovie } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { InfiniteLoad } from "../../components/infinite-load";
import { UiIcon } from "../../components/ui-icon";
import { useErrorToast } from "../../lib/error-toast";
import { LibraryDialog } from "../assets/library-dialog";
import { useVideoTasks } from "./video-client";
import { VideoTaskCard } from "./video-task-card";

export function VideoHistory({ onRestore }: { onRestore: () => void }) {
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
        <VideoTaskCard key={task.id} task={task} onRestore={onRestore} />
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

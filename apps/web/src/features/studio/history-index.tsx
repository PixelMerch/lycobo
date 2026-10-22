import { Button } from "@heroui/react";
import { IconChevronRight, IconPhotoX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { UiIcon } from "../../components/ui-icon";
import { assetContentUrl, useImageHistory } from "./generation-client";
import { GenerationLoading, statusLabel } from "./generation-status";
import { scrollToHistoryTask } from "./history-navigation";
import { LibraryDialog } from "./library-dialog";
import { useStudioStore } from "./studio-state";

export function HistoryIndex() {
  const query = useImageHistory({ poll: false });
  const jobs = query.data?.pages.flatMap((page) => page.data) ?? [];
  const activeId = useStudioStore((s) => s.activeHistoryId);
  const setActiveId = useStudioStore((s) => s.setActiveHistoryId);
  const rail = useRef<HTMLElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const selectedId = jobs.some((job) => job.id === activeId) ? activeId : jobs[0]?.id;
  useEffect(() => {
    const container = rail.current;
    const selected = container?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!container || !selected || !selectedId) return;
    const box = selected.getBoundingClientRect(),
      bounds = container.getBoundingClientRect();
    if (box.top < bounds.top) container.scrollTop -= bounds.top - box.top;
    else if (box.bottom > bounds.bottom) container.scrollTop += box.bottom - bounds.bottom;
    if (box.left < bounds.left) container.scrollLeft -= bounds.left - box.left;
    else if (box.right > bounds.right) container.scrollLeft += box.right - bounds.right;
  }, [selectedId]);
  return (
    <>
      <aside className="history-rail" aria-label="历史索引" ref={rail}>
        <h2 className="history-rail-title">
          <Button
            variant="tertiary"
            className="history-rail-open"
            aria-label="打开素材库"
            onPress={() => setLibraryOpen(true)}
          >
            <span>历史记录</span>
            <UiIcon icon={IconChevronRight} size="small" />
          </Button>
        </h2>
        {query.isLoading ? null : jobs.length ? (
          jobs.map((job) => {
            const image = job.items.find((item) => item.output_asset_id)?.output_asset_id;
            const generating = job.status === "running" || job.status === "queued";
            if (!image && !generating && job.status !== "succeeded")
              return (
                <Button
                  key={job.id}
                  variant="tertiary"
                  className="history-thumbnail history-failure-thumbnail"
                  aria-label={`查看失败任务 ${job.id}`}
                  aria-current={selectedId === job.id ? "true" : "false"}
                  onPress={() => {
                    setActiveId(job.id);
                    scrollToHistoryTask(job.id);
                  }}
                >
                  <span className="history-failure-label">
                    <UiIcon icon={IconPhotoX} size="action" />
                    <span>{statusLabel[job.status]}</span>
                  </span>
                </Button>
              );
            return (
              <Button
                key={job.id}
                variant="tertiary"
                className={`history-thumbnail${generating ? " generation-pending" : ""}`}
                aria-label={`查看任务 ${job.id}`}
                aria-current={selectedId === job.id ? "true" : "false"}
                onPress={() => {
                  setActiveId(job.id);
                  scrollToHistoryTask(job.id);
                }}
              >
                {generating ? (
                  <span role="status" aria-label={statusLabel[job.status]}>
                    <GenerationLoading />
                  </span>
                ) : image ? (
                  <img src={assetContentUrl(image, true)} alt={job.model} loading="lazy" />
                ) : (
                  <span>{statusLabel[job.status]}</span>
                )}
              </Button>
            );
          })
        ) : (
          <p>暂无记录</p>
        )}
      </aside>
      {libraryOpen && <LibraryDialog onClose={() => setLibraryOpen(false)} />}
    </>
  );
}

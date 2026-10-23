import { Button } from "@heroui/react";
import { IconChevronRight, IconPhotoX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { LibraryDialog } from "../../assets/library-dialog";
import { assetContentUrl, useImageHistory } from "../generation-client";
import { GenerationLoading, statusLabel } from "../generation-status";
import { useStudioStore } from "../studio-state";
import { scrollToHistoryTask } from "./history-navigation";

export function HistoryIndex() {
  const query = useImageHistory({ poll: false });
  const jobs = query.data?.pages.flatMap((page) => page.data) ?? [];
  const activeId = useStudioStore((s) => s.activeHistoryId);
  const setActiveId = useStudioStore((s) => s.setActiveHistoryId);
  const rail = useRef<HTMLDivElement>(null);
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
      {/* The heading stays outside the scroller so the list can never scroll it away. */}
      <aside className="history-rail" aria-label="历史索引">
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
        <div className="history-rail-list" ref={rail}>
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
                    <span className="history-thumbnail-frame">
                      <img src={assetContentUrl(image, true)} alt={job.model} loading="lazy" />
                    </span>
                  ) : (
                    <span>{statusLabel[job.status]}</span>
                  )}
                </Button>
              );
            })
          ) : (
            <p>暂无记录</p>
          )}
        </div>
      </aside>
      {libraryOpen && <LibraryDialog onClose={() => setLibraryOpen(false)} />}
    </>
  );
}

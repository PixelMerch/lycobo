import { Button, toast } from "@heroui/react";
import type { ImageJob } from "@lycoboai/contracts";
import { IconChevronRight, IconPhotoX, IconTrash } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { InfiniteLoad } from "../../../components/infinite-load";
import { ConfirmDialog } from "../../../components/overlays/confirm-dialog";
import { UiIcon } from "../../../components/ui-icon";
import { useErrorToast } from "../../../lib/error-toast";
import { LibraryDialog } from "../../assets/library-dialog";
import { AssetImage } from "../asset-image";
import { useDeleteHistoryTask, useImageHistory } from "../generation-client";
import { GenerationLoading, statusLabel } from "../generation-status";
import { modelDisplayName } from "../models/model-display-name";
import { useModelPresentation } from "../models/model-logos";
import { useStudioStore } from "../studio-state";
import { scrollToHistoryTask } from "./history-navigation";

export function HistoryIndex({
  tool = "create",
}: {
  tool?: "create" | "textile" | "variation" | "all" | null;
}) {
  const query = useImageHistory(tool);
  const catalog = useModelPresentation();
  const deletion = useDeleteHistoryTask();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  useErrorToast(deletion.error?.message);

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
      <aside
        className="history-rail"
        aria-label={tool === "textile" ? "家纺裂变历史索引" : "历史索引"}
      >
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
          {!query.isLoading && (
            <HistoryIndexEntries
              jobs={jobs}
              selectedId={selectedId}
              modelName={(job) => modelDisplayName(job.model, catalog.data?.models ?? [])}
              onSelect={(job) => {
                setActiveId(job.id);
                scrollToHistoryTask(job.id);
              }}
              onDelete={(job) => {
                deletion.reset();
                setDeleteId(job.id);
              }}
            />
          )}
          <InfiniteLoad
            hasMore={query.hasNextPage}
            isLoading={query.isFetchingNextPage}
            isError={query.isError}
            onLoadMore={() => query.fetchNextPage({ cancelRefetch: false })}
          />
        </div>
      </aside>
      <ConfirmDialog
        isOpen={deleteId !== null}
        title="删除这条历史记录？"
        content="删除后将从历史列表移除，已保存的素材仍可在素材库查看。此操作不会取消生成或退还积分。"
        tone="danger"
        confirmLabel="删除"
        isPending={deletion.isPending}
        onCancel={() => {
          if (!deletion.isPending) setDeleteId(null);
        }}
        onConfirm={() => {
          if (deleteId && !deletion.isPending)
            deletion.mutate(deleteId, {
              onSuccess: () => {
                setDeleteId(null);
                toast.success("删除成功");
              },
            });
        }}
      />
      {libraryOpen && (
        <LibraryDialog
          tool={tool === "all" || tool === null ? undefined : tool}
          onClose={() => setLibraryOpen(false)}
        />
      )}
    </>
  );
}

function HistoryIndexEntries({
  jobs,
  selectedId,
  modelName,
  onSelect,
  onDelete,
}: {
  jobs: ImageJob[];
  selectedId: string | null | undefined;
  modelName: (job: ImageJob) => string;
  onSelect: (job: ImageJob) => void;
  onDelete: (job: ImageJob) => void;
}) {
  if (!jobs.length) return <p>暂无记录</p>;
  return jobs.map((job) => (
    <HistoryIndexEntry
      key={job.id}
      job={job}
      selectedId={selectedId}
      modelName={modelName(job)}
      onSelect={onSelect}
      onDelete={onDelete}
    />
  ));
}

function HistoryIndexEntry({
  job,
  selectedId,
  modelName,
  onSelect,
  onDelete,
}: {
  job: ImageJob;
  selectedId: string | null | undefined;
  modelName: string;
  onSelect: (job: ImageJob) => void;
  onDelete: (job: ImageJob) => void;
}) {
  const image = job.items.find((item) => item.output_asset_id)?.output_asset_id;
  const generatedCount = job.items.filter((item) => item.output_asset_id).length;
  const generating = job.status === "running" || job.status === "queued";
  const failed = !image && !generating && job.status !== "succeeded";
  return (
    <div className="history-rail-item">
      <Button
        variant="tertiary"
        className={`history-thumbnail${failed ? " history-failure-thumbnail" : ""}${generating ? " generation-pending" : ""}`}
        aria-label={`${failed ? "查看失败任务" : "查看任务"} ${job.id}`}
        aria-current={selectedId === job.id ? "true" : "false"}
        onPress={() => onSelect(job)}
      >
        <HistoryIndexThumbnail
          failed={failed}
          generating={generating}
          image={image}
          job={job}
          modelName={modelName}
        />
      </Button>
      {generatedCount > 1 && (
        <span className="history-thumbnail-count">
          <span className="sr-only">已生成</span>
          {generatedCount}
          <span className="sr-only">张图片</span>
        </span>
      )}
      {!generating && (
        <Button
          isIconOnly
          size="sm"
          variant="danger-soft"
          className="history-thumbnail-delete"
          aria-label={`删除任务 ${job.id}`}
          onPress={() => onDelete(job)}
        >
          <UiIcon icon={IconTrash} size="small" />
        </Button>
      )}
    </div>
  );
}

function HistoryIndexThumbnail({
  failed,
  generating,
  image,
  job,
  modelName,
}: {
  failed: boolean;
  generating: boolean;
  image: string | null | undefined;
  job: ImageJob;
  modelName: string;
}) {
  if (failed)
    return (
      <span className="history-failure-label">
        <UiIcon icon={IconPhotoX} size="action" />
        <span>{statusLabel[job.status]}</span>
      </span>
    );
  if (generating)
    return (
      <span role="status" aria-label={statusLabel[job.status]}>
        <GenerationLoading />
      </span>
    );
  if (image)
    return (
      <span className="history-thumbnail-frame">
        <AssetImage assetId={image} thumbnail alt={modelName} loading="lazy" />
      </span>
    );
  return <span>{statusLabel[job.status]}</span>;
}

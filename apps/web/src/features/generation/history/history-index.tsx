import { Button } from "@heroui/react";
import type { ImageJob } from "@lycoboai/contracts";
import { IconPhotoX, IconTrash } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { InfiniteLoad } from "../../../components/infinite-load";
import { ConfirmDialog } from "../../../components/overlays/confirm-dialog";
import { UiIcon } from "../../../components/ui-icon";
import { useLocale } from "../../../i18n/locale-store";
import { currentMessages, useMessages } from "../../../i18n/messages";
import { useErrorToast } from "../../../lib/error-toast";
import { toast } from "../../../lib/toast";
import { LibraryDialog } from "../../assets/library-dialog";
import { useDeleteHistoryTask, useImageHistory } from "../generation-client";
import { GenerationLoading, useStatusLabel } from "../generation-status";
import { modelDisplayName } from "../models/model-display-name";
import { useModelPresentation } from "../models/model-logos";
import { useStudioStore } from "../studio-state";
import { HistoryAssetThumbnail } from "./history-asset-thumbnail";
import { historyMessages } from "./history-messages";
import { scrollToHistoryTask } from "./history-navigation";
import { HistoryRail } from "./history-rail";

/** 历史索引栏：缩略图列表、删除与打开素材库。 */
export function HistoryIndex({
  tool = "create",
}: {
  tool?: "create" | "textile" | "variation" | "replica" | "all" | null;
}) {
  const query = useImageHistory(tool);
  const catalog = useModelPresentation();
  const locale = useLocale();
  const deletion = useDeleteHistoryTask();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  useErrorToast(deletion.error?.message);

  const jobs = query.data?.pages.flatMap((page) => page.data) ?? [];
  const activeId = useStudioStore((s) => s.activeHistoryId);
  const setActiveId = useStudioStore((s) => s.setActiveHistoryId);
  const rail = useRef<HTMLDivElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const t = useMessages(historyMessages);
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
      <HistoryRail
        label={tool === "textile" ? t.textileRail : t.rail}
        onOpenLibrary={() => setLibraryOpen(true)}
        listRef={rail}
      >
        {!query.isLoading && (
          <HistoryIndexEntries
            jobs={jobs}
            selectedId={selectedId}
            modelName={(job) => modelDisplayName(job.model, catalog.data?.models ?? [], locale)}
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
      </HistoryRail>
      <ConfirmDialog
        isOpen={deleteId !== null}
        title={t.deleteTitle}
        content={t.deleteContent}
        tone="danger"
        confirmLabel={t.delete}
        isPending={deletion.isPending}
        onCancel={() => {
          if (!deletion.isPending) setDeleteId(null);
        }}
        onConfirm={() => {
          if (deleteId && !deletion.isPending)
            deletion.mutate(deleteId, {
              onSuccess: () => {
                setDeleteId(null);
                toast.success(t.deleted);
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
  if (!jobs.length) return <p>{currentMessages(historyMessages).noRecords}</p>;
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
  const t = useMessages(historyMessages);
  return (
    <div className="history-rail-item">
      <Button
        variant="tertiary"
        className={`history-thumbnail${failed ? " history-failure-thumbnail" : ""}`}
        aria-label={t.viewTask(failed, job.id)}
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
          <span className="sr-only">{t.generatedBefore}</span>
          {generatedCount}
          <span className="sr-only">{t.generatedAfter}</span>
        </span>
      )}
      {!generating && (
        <Button
          isIconOnly
          size="sm"
          variant="danger-soft"
          className="history-thumbnail-delete"
          aria-label={t.deleteTask(job.id)}
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
  const statusLabel = useStatusLabel();
  if (failed)
    return (
      <span className="history-failure-label">
        <UiIcon icon={IconPhotoX} size="action" />
        <span>{statusLabel(job.status)}</span>
      </span>
    );
  if (generating)
    return (
      <span role="status" aria-label={statusLabel(job.status)}>
        <GenerationLoading />
      </span>
    );
  if (image) return <HistoryAssetThumbnail assetId={image} alt={modelName} />;
  return <span>{statusLabel(job.status)}</span>;
}

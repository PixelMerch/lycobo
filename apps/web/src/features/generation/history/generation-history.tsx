import { EmptyState } from "@heroui/react";
import type { ImageJob } from "@lycoboai/contracts";
import { IconPhotoPlus } from "@tabler/icons-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { InfiniteLoad } from "../../../components/infinite-load";
import { UiIcon } from "../../../components/ui-icon";
import { useErrorToast } from "../../../lib/error-toast";
import type { PreviewImage } from "../../image-workspace/image-preview";
import { useImageHistory, useImageSession } from "../generation-client";
import { modelDisplayName } from "../models/model-display-name";
import { useModelPresentation } from "../models/model-logos";
import { useStudioStore } from "../studio-state";
import { GenerationHistoryCard } from "./generation-history-card";
import { HistoryImagePreview, historyPreviewImages } from "./history-image-preview";
import { historyContentTop } from "./history-navigation";
import { useHistoryTaskTarget } from "./use-history-task-target";

/** Batches of five or more report their progress; larger batches initially show twelve images. */
const batchFold = 12;
export function GenerationHistory({
  compact = false,
  tool = "create",
  onRestore,
}: {
  compact?: boolean;
  tool?: "create" | "textile" | "variation" | "all" | null;
  onRestore?: import("./history-task-tools").HistoryRestore;
}) {
  const session = useImageSession();
  const query = useImageHistory(tool);
  const catalog = useModelPresentation();
  const target = useHistoryTaskTarget(compact || tool === null);
  const jobs = historyJobs(query, target, tool);
  const [preview, setPreview] = useState<{ images: PreviewImage[]; assetId: string } | null>(null);
  const previewTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (preview || !previewTrigger.current) return;
    // Restore only after the animated controlled dialog has unmounted. The
    // trigger lives outside Modal's DialogTrigger tree, so retain it explicitly.
    if (previewTrigger.current.isConnected) {
      previewTrigger.current.focus({ preventScroll: true });
    }
    previewTrigger.current = null;
  }, [preview]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const folded = (job: ImageJob) => job.items.length > batchFold && !expanded.has(job.id);
  const toggleFold = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const listRef = useRef<HTMLDivElement>(null);
  const activeHistoryId = useStudioStore((s) => s.activeHistoryId);
  const setActiveHistoryId = useStudioStore((s) => s.setActiveHistoryId);
  const jobIds = jobs.map((job) => job.id).join(",");
  useErrorToast(
    query.isError && !/请先登录|登录已过期|重新登录/.test(query.error?.message ?? "")
      ? (query.error?.message ?? "服务暂时不可用，请稍后重试。")
      : null,
  );
  useActiveHistory(listRef, compact, jobIds, setActiveHistoryId);
  const notice = historyNotice(session, query, tool, compact, jobs.length > 0);
  if (notice !== undefined) return notice;
  return (
    <>
      <div className="generation-history" ref={listRef}>
        {jobs.map((job) => (
          <GenerationHistoryCard
            key={job.id}
            job={job}
            compact={compact}
            active={activeHistoryId === job.id}
            modelName={modelDisplayName(job.model, catalog.data?.models ?? [])}
            onRestore={onRestore}
            folded={folded(job)}
            toggleFold={() => toggleFold(job.id)}
            onPreview={(trigger, assetId) => {
              previewTrigger.current = trigger;
              setPreview({ images: historyPreviewImages(jobs), assetId });
            }}
          />
        ))}
        <InfiniteLoad
          hasMore={query.hasNextPage}
          isLoading={query.isFetchingNextPage}
          isError={query.isError}
          onLoadMore={() => query.fetchNextPage({ cancelRefetch: false })}
        />
      </div>
      {preview && tool !== null && (
        <HistoryImagePreview
          images={preview.images}
          assetId={preview.assetId}
          tool={tool}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}

type HistoryTool = Parameters<typeof useImageHistory>[0];

function historyNotice(
  session: ReturnType<typeof useImageSession>,
  query: ReturnType<typeof useImageHistory>,
  tool: HistoryTool,
  compact: boolean,
  hasJobs: boolean,
) {
  if (session.isError && /请先登录|登录已过期|重新登录/.test(session.error?.message ?? ""))
    return (
      <EmptyState className="empty-state generation-empty-state">
        <UiIcon icon={IconPhotoPlus} size="illustration" />
        <p>登录后查看生成记录</p>
      </EmptyState>
    );
  if (session.isError || query.isError) return null;
  if (session.isPending || (tool !== null && query.isPending)) return null;
  if (!hasJobs)
    return (
      <EmptyState className="empty-state generation-empty-state">
        <UiIcon icon={IconPhotoPlus} size="illustration" />
        <p>{compact ? "暂无任务" : "生成的图片会显示在这里"}</p>
      </EmptyState>
    );
  return undefined;
}

function historyJobs(
  query: ReturnType<typeof useImageHistory>,
  target: ImageJob | null | undefined,
  tool: HistoryTool,
) {
  const targetJob = target && matchesHistoryTool(target, tool) ? target : undefined;
  const loadedJobs = query.data?.pages.flatMap((page) => page.data) ?? [];
  return targetJob && !loadedJobs.some((job) => job.id === targetJob.id)
    ? [targetJob, ...loadedJobs]
    : loadedJobs;
}

function matchesHistoryTool(job: ImageJob, tool: Parameters<typeof useImageHistory>[0]) {
  if (tool === "all") return true;
  if (tool === "variation") return !!job.input?.variation;
  if (tool === "textile") return !!job.input?.textileSet;
  return !job.input?.textileSet && !job.input?.variation;
}

function useActiveHistory(
  listRef: RefObject<HTMLDivElement | null>,
  compact: boolean,
  jobIds: string,
  setActiveHistoryId: (id: string) => void,
) {
  useEffect(() => {
    const list = listRef.current;
    if (compact || !list || !jobIds) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const articles = Array.from(list.querySelectorAll<HTMLElement>("[data-history-id]"));
      const line = historyContentTop() + 1;
      let current = articles[0];
      for (const article of articles) {
        if (article.getBoundingClientRect().top > line) break;
        current = article;
      }
      if (
        window.scrollY > 0 &&
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2
      )
        current = articles.at(-1);
      if (current?.dataset.historyId) setActiveHistoryId(current.dataset.historyId);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(list);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [compact, jobIds, listRef, setActiveHistoryId]);
}

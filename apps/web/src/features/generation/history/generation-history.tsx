import { EmptyState } from "@heroui/react";
import { type ImageJob, imageJobTool } from "@lycoboai/contracts";
import { IconPhotoPlus } from "@tabler/icons-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { DataSkeleton } from "../../../components/data-skeleton";
import { InfiniteLoad } from "../../../components/infinite-load";
import { UiIcon } from "../../../components/ui-icon";
import type { Locale } from "../../../i18n/locale";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { useErrorToast } from "../../../lib/error-toast";
import type { PreviewImage } from "../../image-workspace/image-preview";
import { useImageHistory, useImageSession } from "../generation-client";
import { isSignInError } from "../image-request";
import { modelDisplayName } from "../models/model-display-name";
import { useModelPresentation } from "../models/model-logos";
import { useStudioStore } from "../studio-state";
import { GenerationHistoryCard } from "./generation-history-card";
import { HistoryImagePreview, historyPreviewImages } from "./history-image-preview";
import { historyMessages } from "./history-messages";
import { historyContentTop } from "./history-navigation";
import { useHistoryTaskTarget } from "./use-history-task-target";

/** Batches of five or more report their progress; larger batches initially show twelve images. */
const batchFold = 12;
/** 生成历史列表：按工具筛选任务，可预览结果并定位当前任务。 */
export function GenerationHistory({
  compact = false,
  tool = "create",
  onRestore,
}: {
  compact?: boolean;
  tool?: "create" | "textile" | "variation" | "replica" | "all" | null;
  onRestore?: import("./history-task-tools").HistoryRestore;
}) {
  const session = useImageSession();
  const query = useImageHistory(tool);
  const t = useMessages(historyMessages);
  const catalog = useModelPresentation();
  const locale = useLocale();
  const target = useHistoryTaskTarget(compact || tool === null);
  const jobs = historyJobs(query, target, tool);
  const [preview, setPreview] = useState<{ images: PreviewImage[]; assetId: string } | null>(null);
  const previewTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (preview || !previewTrigger.current) return;
    // 等带动画的受控弹窗卸载后再把焦点还给入口；入口不在 Modal 的 DialogTrigger 里，需要单独记住。
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
    query.isError && !isSignInError(query.error)
      ? (query.error?.message ?? t.serviceUnavailable)
      : null,
  );
  useActiveHistory(listRef, compact, jobIds, setActiveHistoryId);
  const notice = historyNotice(session, query, tool, compact, jobs.length > 0, t);
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
            modelName={modelDisplayName(job.model, catalog.data?.models ?? [], locale)}
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
  t: (typeof historyMessages)[Locale],
) {
  if (session.isError && isSignInError(session.error))
    return (
      <EmptyState className="empty-state generation-empty-state">
        <UiIcon icon={IconPhotoPlus} size="illustration" />
        <p>{t.signInForHistory}</p>
      </EmptyState>
    );
  if (hasJobs) return undefined;
  if (session.isError || query.isError) return null;
  if (session.isPending || (tool !== null && query.isPending))
    return <DataSkeleton layout="history" />;
  return (
    <EmptyState className="empty-state generation-empty-state">
      <UiIcon icon={IconPhotoPlus} size="illustration" />
      <p>{compact ? t.noTasks : t.emptyHistory}</p>
    </EmptyState>
  );
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
  return tool === "all" || imageJobTool(job) === (tool ?? "create");
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

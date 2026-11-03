import { Button, EmptyState } from "@heroui/react";
import { type ImageJob, textileViews } from "@lycoboai/contracts";
import { IconChevronDown, IconChevronUp, IconPhotoPlus } from "@tabler/icons-react";
import { type CSSProperties, Fragment, useEffect, useRef, useState } from "react";
import { InfiniteLoad } from "../../../components/infinite-load";
import { UiIcon } from "../../../components/ui-icon";
import { useErrorToast } from "../../../lib/error-toast";
import type { PreviewImage } from "../../image-workspace/image-preview";
import { useImageHistory, useImageSession } from "../generation-client";
import { GenerationLoading, statusLabel } from "../generation-status";
import { modelDisplayName } from "../models/model-display-name";
import { useModelPresentation } from "../models/model-logos";
import { useStudioStore } from "../studio-state";
import { HistoryImagePreview, historyPreviewImages } from "./history-image-preview";
import { historyContentTop } from "./history-navigation";
import { HistoryTaskMeta } from "./history-task-meta";
import { HistoryPrompt, HistoryTaskActions } from "./history-task-tools";
import { ResultImage } from "./result-image";
import { useHistoryTaskTarget } from "./use-history-task-target";

/** Batches of five or more report their progress; larger batches initially show twelve images. */
const batchSize = 5;
const batchFold = 12;
function BatchProgress({ items }: { items: ImageJob["items"] }) {
  const tally = (...statuses: ImageJob["items"][number]["status"][]) =>
    items.filter((item) => statuses.includes(item.status)).length;
  const done = tally("succeeded");
  if (done === items.length) return null;
  const running = tally("queued", "running");
  const failed = tally("failed");
  const unresolved = tally("needs_reconciliation");
  const parts = [
    `已完成 ${done}/${items.length}`,
    running ? `生成中 ${running}` : "",
    failed ? `失败 ${failed}` : "",
    unresolved ? `待确认 ${unresolved}` : "",
  ].filter(Boolean);
  return (
    <p className="history-batch-progress">
      {parts.map((part, index) => (
        <Fragment key={part}>
          {index > 0 && " · "}
          <span>{part}</span>
        </Fragment>
      ))}
    </p>
  );
}

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
  const targetJob =
    target &&
    (tool === "all" ||
      (tool === "variation"
        ? !!target.input?.variation
        : tool === "textile"
          ? !!target.input?.textileSet
          : !target.input?.textileSet && !target.input?.variation))
      ? target
      : undefined;
  const loadedJobs = query.data?.pages.flatMap((page) => page.data) ?? [];
  const jobs =
    targetJob && !loadedJobs.some((job) => job.id === targetJob.id)
      ? [targetJob, ...loadedJobs]
      : loadedJobs;
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
  }, [compact, jobIds, setActiveHistoryId]);
  if (session.isError && /请先登录|登录已过期|重新登录/.test(session.error?.message ?? ""))
    return (
      <EmptyState className="empty-state generation-empty-state">
        <UiIcon icon={IconPhotoPlus} size="illustration" />
        <p>登录后查看生成记录</p>
      </EmptyState>
    );
  if (session.isError || query.isError) return null;
  if (session.isPending || (tool !== null && query.isPending)) return null;
  if (!jobs.length)
    return (
      <EmptyState className="empty-state generation-empty-state">
        <UiIcon icon={IconPhotoPlus} size="illustration" />
        <p>{compact ? "暂无任务" : "生成的图片会显示在这里"}</p>
      </EmptyState>
    );
  return (
    <>
      <div className="generation-history" ref={listRef}>
        {jobs.map((job) => (
          <article
            className="generation-job"
            key={job.id}
            id={compact ? undefined : `job-${job.id}`}
            data-history-id={compact ? undefined : job.id}
            data-active={!compact && activeHistoryId === job.id ? "true" : undefined}
          >
            <header>
              <HistoryTaskMeta
                job={job}
                modelName={modelDisplayName(job.model, catalog.data?.models ?? [])}
              />
              {!compact && job.items.length >= batchSize && <BatchProgress items={job.items} />}
              {!compact && <HistoryTaskActions job={job} onRestore={onRestore} />}
            </header>
            {compact ? (
              <p className="generation-prompt">{job.prompt}</p>
            ) : (
              <HistoryPrompt job={job} />
            )}
            {!compact && (
              <div
                id={`results-${job.id}`}
                className="generation-results"
                data-count={job.items.length}
                style={
                  {
                    "--history-image-ratio": job.aspect_ratio.replace(":", " / "),
                  } as CSSProperties
                }
                data-failed={
                  job.items.some(
                    (item) => item.status === "failed" || item.status === "needs_reconciliation",
                  ) || undefined
                }
              >
                {(folded(job) ? job.items.slice(0, batchFold) : job.items).map((item) => (
                  <div
                    key={item.id}
                    id={`result-${item.id}`}
                    className={
                      item.status === "failed" || item.status === "needs_reconciliation"
                        ? "generation-failed-result"
                        : undefined
                    }
                  >
                    {job.input?.variation && (
                      <p className="textile-result-view">
                        {job.input.variation.items[item.position]?.title}
                      </p>
                    )}
                    {job.input?.textileSet && (
                      <p className="textile-result-view">
                        {
                          textileViews.find(
                            (view) => view.id === job.input?.textileSet?.views[item.position],
                          )?.name
                        }
                      </p>
                    )}
                    {item.output_asset_id ? (
                      <ResultImage
                        assetId={item.output_asset_id}
                        thumbnail={job.requested_count > 1}
                        position={item.position}
                        width={item.width}
                        height={item.height}
                        prompt={job.prompt}
                        onPreview={(trigger) => {
                          previewTrigger.current = trigger;
                          setPreview({
                            images: historyPreviewImages(jobs),
                            assetId: item.output_asset_id ?? "",
                          });
                        }}
                      />
                    ) : (
                      <div
                        className={`generation-placeholder${
                          item.status === "running" || item.status === "queued"
                            ? " generation-pending"
                            : item.status === "failed" || item.status === "needs_reconciliation"
                              ? " generation-failed"
                              : ""
                        }`}
                        role="status"
                        aria-label={statusLabel[item.status]}
                      >
                        {item.status === "running" || item.status === "queued" ? (
                          <GenerationLoading />
                        ) : (
                          <p className="generation-failure-message">
                            {item.status === "failed"
                              ? "任务未能完成，积分已退回，请您稍后重试。"
                              : item.error_code === "PROVIDER_TIMEOUT"
                                ? "生成超时，请重新生成。将先查询并恢复已有结果。"
                                : "生成结果和积分状态正在确认，请稍后查看。"}
                          </p>
                        )}
                        {(item.status === "failed" || item.status === "needs_reconciliation") && (
                          <HistoryTaskActions job={job} item={item} />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!compact && job.items.length > batchFold && (
              <Button
                size="sm"
                variant="tertiary"
                className="history-batch-toggle"
                aria-expanded={!folded(job)}
                aria-controls={`results-${job.id}`}
                onPress={() => toggleFold(job.id)}
              >
                <UiIcon icon={folded(job) ? IconChevronDown : IconChevronUp} size="small" />
                {folded(job) ? `展开全部 ${job.items.length} 张` : "收起"}
              </Button>
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

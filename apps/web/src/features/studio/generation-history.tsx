import { Button, EmptyState } from "@heroui/react";
import type { ImageJob } from "@lycoboai/contracts";
import { IconPhoto } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { UiIcon } from "../../components/ui-icon";
import { useErrorToast } from "../../lib/error-toast";
import { useImageHistory, useImageSession } from "./generation-client";
import { GenerationLoading, statusLabel } from "./generation-status";
import { historyContentTop } from "./history-navigation";
import { HistoryTaskMeta } from "./history-task-meta";
import { HistoryPrompt, HistoryTaskActions } from "./history-task-tools";
import { ImagePreviewDialog } from "./image-preview";
import { ResultImage } from "./result-image";
import { useStudioStore } from "./studio-state";

/** Generated images of one task, in result order; used by the preview viewer. */
const generatedImages = (job: ImageJob) =>
  job.items.flatMap((item) =>
    item.output_asset_id
      ? [
          {
            id: item.output_asset_id,
            publicId: item.output_public_id,
            width: item.width,
            height: item.height,
          },
        ]
      : [],
  );
export function GenerationHistory({ compact = false }: { compact?: boolean }) {
  const session = useImageSession();
  const query = useImageHistory();
  const jobs = query.data?.pages.flatMap((page) => page.data) ?? [];
  const [preview, setPreview] = useState<{ jobId: string; index: number } | null>(null);
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
      <EmptyState className="empty-state">
        <UiIcon icon={IconPhoto} size="illustration" />
        <h2>登录后查看生成记录</h2>
        <p>登录账号后，生成结果会保存在这里。</p>
      </EmptyState>
    );
  if (session.isError || query.isError) return null;
  if (session.isPending || query.isPending) return null;
  if (!jobs.length)
    return (
      <EmptyState className="empty-state">
        <UiIcon icon={IconPhoto} size="illustration" />
        <h2>{compact ? "暂无任务" : "还没有生成记录"}</h2>
        <p>提交后的生成任务会保存在这里。</p>
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
              <HistoryTaskMeta job={job} />
              {!compact && <HistoryTaskActions job={job} />}
            </header>
            {compact ? (
              <p className="generation-prompt">{job.prompt}</p>
            ) : (
              <HistoryPrompt job={job} />
            )}
            {!compact && (
              <div
                className="generation-results"
                data-count={job.items.length}
                data-failed={
                  job.items.some(
                    (item) => item.status === "failed" || item.status === "needs_reconciliation",
                  ) || undefined
                }
              >
                {job.items.map((item) => (
                  <div
                    key={item.id}
                    id={`result-${item.id}`}
                    className={
                      item.status === "failed" || item.status === "needs_reconciliation"
                        ? "generation-failed-result"
                        : undefined
                    }
                  >
                    {item.output_asset_id ? (
                      <ResultImage
                        assetId={item.output_asset_id}
                        position={item.position}
                        prompt={job.prompt}
                        onPreview={(trigger) => {
                          previewTrigger.current = trigger;
                          setPreview({
                            jobId: job.id,
                            index: generatedImages(job).findIndex(
                              (image) => image.id === item.output_asset_id,
                            ),
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
                              : "任务未能完成，积分状态正在确认，请稍后查看。"}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
        {query.hasNextPage && (
          <Button
            variant="secondary"
            isDisabled={query.isFetchingNextPage}
            onPress={() => {
              void query.fetchNextPage();
            }}
          >
            加载更多记录
          </Button>
        )}
      </div>
      {(() => {
        const job = preview ? jobs.find((entry) => entry.id === preview.jobId) : undefined;
        return job && preview ? (
          <ImagePreviewDialog
            images={generatedImages(job)}
            meta={{
              taskPublicId: job.public_id,
              model: job.model,
              createdAt: job.created_at,
              prompt: job.prompt,
              references: job.input?.referenceAssetIds ?? [],
            }}
            initialIndex={Math.max(preview.index, 0)}
            onClose={() => setPreview(null)}
          />
        ) : null;
      })()}
    </>
  );
}

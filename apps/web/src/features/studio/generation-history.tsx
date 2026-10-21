import { Button, EmptyState, ToggleButton, Tooltip } from "@heroui/react";
import type { ImageJob } from "@lycoboai/contracts";
import {
  IconAspectRatio,
  IconChevronRight,
  IconDownload,
  IconPhoto,
  IconPhotoX,
  IconSparkles,
  IconStar,
  IconStarFilled,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { UiIcon } from "../../components/ui-icon";
import { copyToClipboard } from "../../lib/clipboard";
import { useErrorToast } from "../../lib/error-toast";
import {
  assetContentUrl,
  downloadAsset,
  useImageHistory,
  useImageSession,
} from "./generation-client";
import { HistoryPrompt, HistoryTaskActions } from "./history-task-tools";
import { ImagePreviewDialog } from "./image-preview";
import { LibraryDialog } from "./library-dialog";
import { useStudioStore } from "./studio-state";

export const statusLabel: Record<ImageJob["status"], string> = {
  queued: "排队中",
  running: "生成中",
  succeeded: "成功",
  partially_failed: "失败",
  failed: "失败",
  needs_reconciliation: "失败",
};
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
async function copyTaskId(id: string | undefined) {
  if (!id) return;
  await copyToClipboard(id);
}
function ResultImage({
  assetId,
  position,
  prompt,
  onPreview,
}: {
  assetId: string;
  position: number;
  prompt: string;
  onPreview: () => void;
}) {
  const favorite = useStudioStore((s) => s.favorites.includes(assetId));
  const toggleFavorite = useStudioStore((s) => s.toggleFavorite);
  return (
    <div className="generation-media">
      <Button
        variant="tertiary"
        className="generation-media-open"
        aria-label={`预览图片 ${position + 1}`}
        onPress={(event) => {
          // The controlled modal captures the active element when it mounts.
          // Virtual clicks may activate this button without first focusing it.
          if (event.target instanceof HTMLElement) event.target.focus({ preventScroll: true });
          onPreview();
        }}
      >
        <img
          src={assetContentUrl(assetId, true)}
          loading="lazy"
          alt={`${prompt}，图片${position + 1}`}
        />
      </Button>
      <div className="generation-media-actions">
        <Tooltip delay={0}>
          <Button
            isIconOnly
            variant="tertiary"
            className="generation-media-action"
            aria-label="下载原图"
            onPress={() => downloadAsset(assetId)}
          >
            <UiIcon icon={IconDownload} />
          </Button>
          <Tooltip.Content placement="top">下载原图</Tooltip.Content>
        </Tooltip>
        <Tooltip delay={0}>
          <ToggleButton
            isIconOnly
            variant="ghost"
            className="generation-media-action"
            aria-label={favorite ? "取消收藏" : "收藏图片"}
            isSelected={favorite}
            onChange={() => toggleFavorite(assetId)}
          >
            <UiIcon icon={favorite ? IconStarFilled : IconStar} />
          </ToggleButton>
          <Tooltip.Content placement="top">{favorite ? "取消收藏" : "收藏"}</Tooltip.Content>
        </Tooltip>
      </div>
    </div>
  );
}
function GenerationLoading() {
  return (
    <div className="generation-loading-icon">
      <UiIcon icon={IconSparkles} size="illustration" />
    </div>
  );
}
export function GenerationHistory({ compact = false }: { compact?: boolean }) {
  const session = useImageSession();
  const query = useImageHistory();
  const jobs = query.data?.pages.flatMap((page) => page.data) ?? [];
  const [preview, setPreview] = useState<{ jobId: string; index: number } | null>(null);
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
      const line = (document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 64) + 24;
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
              <dl className="generation-meta" aria-label="任务信息">
                <div>
                  <dt className="sr-only">模型</dt>
                  <dd>
                    <span className="model-tag">{job.model}</span>
                  </dd>
                </div>
                <div>
                  <dt className="sr-only">时间</dt>
                  <dd>
                    <time dateTime={job.created_at}>
                      {new Date(job.created_at).toLocaleString("zh-CN")}
                    </time>
                  </dd>
                </div>
                <div className="generation-task-id-field">
                  <dt>任务ID：</dt>
                  <dd>
                    <Tooltip delay={0} isDisabled={!job.public_id}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="generation-task-id"
                        isDisabled={!job.public_id}
                        aria-label={
                          job.public_id ? `复制任务 ID ${job.public_id}` : "任务 ID 待同步"
                        }
                        onPress={(event) => {
                          if (event.pointerType !== "mouse") void copyTaskId(job.public_id);
                        }}
                        onDoubleClick={() => void copyTaskId(job.public_id)}
                      >
                        {job.public_id ?? "待同步"}
                      </Button>
                      <Tooltip.Content placement="top">双击复制任务 ID</Tooltip.Content>
                    </Tooltip>
                  </dd>
                </div>
                <div className="generation-meta-ratio">
                  <dt className="sr-only">比例</dt>
                  <UiIcon icon={IconAspectRatio} size="small" />
                  <dd>{job.aspect_ratio}</dd>
                </div>
                <div className="generation-meta-units">
                  <dt className="sr-only">分辨率与张数</dt>
                  <dd>{job.resolution}</dd>
                  <span className="generation-meta-divider" aria-hidden="true" />
                  <dd>{job.requested_count} 张</dd>
                </div>
              </dl>
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
                        onPreview={() =>
                          setPreview({
                            jobId: job.id,
                            index: generatedImages(job).findIndex(
                              (image) => image.id === item.output_asset_id,
                            ),
                          })
                        }
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
                    document
                      .getElementById(`job-${job.id}`)
                      ?.scrollIntoView({ block: "start", behavior: "instant" });
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
                  document
                    .getElementById(`job-${job.id}`)
                    ?.scrollIntoView({ block: "start", behavior: "instant" });
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

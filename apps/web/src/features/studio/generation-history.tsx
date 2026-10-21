import { Alert, Button, EmptyState, Link, ToggleButton, Tooltip, toast } from "@heroui/react";
import type { ImageJob } from "@lycoboai/contracts";
import {
  IconAspectRatio,
  IconDownload,
  IconPhoto,
  IconSparkles,
  IconStar,
  IconStarFilled,
} from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import "./image-public-id.css";
import { UiIcon } from "../../components/ui-icon";
import {
  assetContentUrl,
  downloadAsset,
  useImageHistory,
  useImageSession,
} from "./generation-client";
import { HistoryPrompt, HistoryTaskActions } from "./history-task-tools";
import { useStudioStore } from "./studio-state";

export const statusLabel: Record<ImageJob["status"], string> = {
  queued: "排队中",
  running: "生成中",
  succeeded: "成功",
  partially_failed: "失败",
  failed: "失败",
  needs_reconciliation: "失败",
};
async function copyTaskId(id: string | undefined) {
  if (!id) return;
  try {
    await navigator.clipboard.writeText(id);
    toast.success("复制成功");
  } catch {
    toast.danger("复制失败，请手动选择复制");
  }
}
const errorLabel = (code: string | null) => {
  if (code === "PROVIDER_HTTP_401" || code === "PROVIDER_HTTP_403")
    return "模型服务鉴权失败，请检查 API key 和模型权限。";
  if (code === "PROVIDER_HTTP_429") return "模型服务额度不足或请求受限。";
  if (code === "PROVIDER_HTTP_400" || code === "PROVIDER_HTTP_422")
    return "模型服务不支持这组参数或参考图，请调整后新建任务。";
  return "本张图片未生成成功，请检查服务配置。";
};
function ResultImage({
  assetId,
  publicId,
  position,
  prompt,
}: {
  assetId: string;
  publicId?: string | null | undefined;
  position: number;
  prompt: string;
}) {
  const favorite = useStudioStore((s) => s.favorites.includes(assetId));
  const toggleFavorite = useStudioStore((s) => s.toggleFavorite);
  return (
    <>
      <div className="generation-media">
        <Link
          href={assetContentUrl(assetId)}
          target="_blank"
          rel="noreferrer"
          aria-label={`查看原图 ${position + 1}`}
        >
          <img
            src={assetContentUrl(assetId, true)}
            loading="lazy"
            alt={`${prompt}，图片${position + 1}`}
          />
        </Link>
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
      {publicId && <p className="image-public-id">图片 ID：{publicId}</p>}
    </>
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
  const listRef = useRef<HTMLDivElement>(null);
  const activeHistoryId = useStudioStore((s) => s.activeHistoryId);
  const setActiveHistoryId = useStudioStore((s) => s.setActiveHistoryId);
  const jobIds = jobs.map((job) => job.id).join(",");
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
  if (session.isError || query.isError)
    return (
      <Alert className="generation-message" role="alert" status="danger">
        <Alert.Content>
          <Alert.Description>{session.error?.message ?? query.error?.message}</Alert.Description>
          <Button
            variant="secondary"
            onPress={() => {
              void session.refetch();
              void query.refetch();
            }}
          >
            重新连接
          </Button>
        </Alert.Content>
      </Alert>
    );
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
              <div className="generation-task-id-field">
                <dt>任务ID：</dt>
                <dd>
                  <Tooltip delay={0} isDisabled={!job.public_id}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="generation-task-id"
                      isDisabled={!job.public_id}
                      aria-label={job.public_id ? `复制任务 ID ${job.public_id}` : "任务 ID 待同步"}
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
              <div>
                <dt className="sr-only">时间</dt>
                <dd>
                  <time dateTime={job.created_at}>
                    {new Date(job.created_at).toLocaleString("zh-CN")}
                  </time>
                </dd>
              </div>
              <div>
                <dt className="sr-only">模型</dt>
                <dd>
                  <span className="generation-model-tag">{job.model}</span>
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
            <div className="generation-results" data-count={job.items.length}>
              {job.items.map((item) => (
                <div key={item.id} id={`result-${item.id}`}>
                  {item.output_asset_id ? (
                    <ResultImage
                      assetId={item.output_asset_id}
                      publicId={item.output_public_id}
                      position={item.position}
                      prompt={job.prompt}
                    />
                  ) : (
                    <div
                      className={`generation-placeholder${item.status === "running" || item.status === "queued" ? " generation-pending" : ""}`}
                      role="status"
                      aria-label={statusLabel[item.status]}
                    >
                      {item.status === "running" || item.status === "queued" ? (
                        <GenerationLoading />
                      ) : (
                        <HistoryTaskActions job={job} retryOnly />
                      )}
                      {(item.status === "failed" || item.status === "needs_reconciliation") && (
                        <Alert
                          className="generation-placeholder-error"
                          role="alert"
                          status="danger"
                        >
                          <Alert.Content>
                            <Alert.Description>
                              {item.status === "needs_reconciliation"
                                ? "未能获取可用图片。"
                                : errorLabel(item.error_code)}
                            </Alert.Description>
                          </Alert.Content>
                        </Alert>
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
  );
}
export function HistoryIndex() {
  const query = useImageHistory({ poll: false });
  const jobs = query.data?.pages.flatMap((page) => page.data) ?? [];
  const activeId = useStudioStore((s) => s.activeHistoryId);
  const setActiveId = useStudioStore((s) => s.setActiveHistoryId);
  const rail = useRef<HTMLElement>(null);
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
    <aside className="history-rail" aria-label="历史索引" ref={rail}>
      <h2>历史</h2>
      {query.isLoading ? null : jobs.length ? (
        jobs.map((job) => {
          const image = job.items.find((item) => item.output_asset_id)?.output_asset_id;
          const generating = job.status === "running" || job.status === "queued";
          if (!image && !generating && job.status !== "succeeded")
            return (
              <div
                key={job.id}
                className="history-thumbnail history-failure-thumbnail"
                aria-current={selectedId === job.id ? "true" : "false"}
              >
                <HistoryTaskActions job={job} retryOnly compact />
              </div>
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
  );
}

import { Button, Tooltip } from "@heroui/react";
import type { ImageJob } from "@lycoboai/contracts";
import {
  IconAspectRatio,
  IconClock,
  IconDownload,
  IconHash,
  IconLayersIntersect,
  IconMaximize,
  IconPhoto,
  IconSparkles,
  IconStar,
  IconStarFilled,
} from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { UiIcon } from "../../components/ui-icon";
import { assetContentUrl, useImageHistory, useImageSession } from "./generation-client";
import { HistoryPrompt, HistoryTaskActions } from "./history-task-tools";
import { useStudioStore } from "./studio-state";

export const statusLabel: Record<ImageJob["status"], string> = {
  queued: "排队中",
  running: "生成中",
  succeeded: "已完成",
  partially_failed: "部分完成",
  failed: "生成失败",
  needs_reconciliation: "结果待核对",
};
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
  position,
  prompt,
}: {
  assetId: string;
  position: number;
  prompt: string;
}) {
  const favorite = useStudioStore((s) => s.favorites.includes(assetId));
  const toggleFavorite = useStudioStore((s) => s.toggleFavorite);
  return (
    <div className="generation-media">
      <a
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
      </a>
      <div className="generation-media-actions">
        <Tooltip delay={0}>
          <Button
            isIconOnly
            variant="tertiary"
            className="generation-media-action"
            aria-label="下载原图"
            onPress={() => {
              const link = document.createElement("a");
              link.href = assetContentUrl(assetId);
              link.download = `${assetId}.png`;
              link.click();
            }}
          >
            <UiIcon icon={IconDownload} />
          </Button>
          <Tooltip.Content placement="top">下载原图</Tooltip.Content>
        </Tooltip>
        <Tooltip delay={0}>
          <Button
            isIconOnly
            variant="tertiary"
            className="generation-media-action"
            aria-label={favorite ? "取消收藏" : "收藏图片"}
            aria-pressed={favorite}
            onPress={() => toggleFavorite(assetId)}
          >
            <UiIcon icon={favorite ? IconStarFilled : IconStar} />
          </Button>
          <Tooltip.Content placement="top">{favorite ? "取消收藏" : "收藏"}</Tooltip.Content>
        </Tooltip>
      </div>
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
  if (session.isError || query.isError)
    return (
      <div className="generation-message" role="alert">
        <p>{session.error?.message ?? query.error?.message}</p>
        <Button
          variant="secondary"
          onPress={() => {
            void session.refetch();
            void query.refetch();
          }}
        >
          重新连接
        </Button>
      </div>
    );
  if (session.isPending || query.isPending)
    return (
      <p className="generation-message" role="status">
        正在加载记录…
      </p>
    );
  if (!jobs.length)
    return (
      <div className="empty-state">
        <UiIcon icon={IconPhoto} size="illustration" />
        <h2>{compact ? "暂无任务" : "还没有生成记录"}</h2>
        <p>提交后的生成任务会保存在这里。</p>
      </div>
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
            {job.status !== "succeeded" && <span role="status">{statusLabel[job.status]}</span>}
            <dl className="generation-meta" aria-label="任务信息">
              <div>
                <dt title="任务 ID">
                  <UiIcon icon={IconHash} size="small" />
                  <span className="sr-only">任务 ID</span>
                </dt>
                <dd>{job.id}</dd>
              </div>
              <div>
                <dt title="时间">
                  <UiIcon icon={IconClock} size="small" />
                  <span className="sr-only">时间</span>
                </dt>
                <dd>
                  <time dateTime={job.created_at}>
                    {new Date(job.created_at).toLocaleString("zh-CN")}
                  </time>
                </dd>
              </div>
              <div>
                <dt title="模型">
                  <UiIcon icon={IconSparkles} size="small" />
                  <span className="sr-only">模型</span>
                </dt>
                <dd>{job.model}</dd>
              </div>
              <div>
                <dt title="比例">
                  <UiIcon icon={IconAspectRatio} size="small" />
                  <span className="sr-only">比例</span>
                </dt>
                <dd>{job.aspect_ratio}</dd>
              </div>
              <div>
                <dt title="分辨率">
                  <UiIcon icon={IconMaximize} size="small" />
                  <span className="sr-only">分辨率</span>
                </dt>
                <dd>{job.resolution}</dd>
              </div>
              <div>
                <dt title="张数">
                  <UiIcon icon={IconLayersIntersect} size="small" />
                  <span className="sr-only">张数</span>
                </dt>
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
          {job.status === "needs_reconciliation" && (
            <p role="alert">本次调用结果尚未确认，需要核对服务商记录，请勿重复生成。</p>
          )}
          {!compact && (
            <div className="generation-results" data-count={job.items.length}>
              {job.items.map((item) => (
                <div key={item.id} id={`result-${item.id}`}>
                  {item.output_asset_id ? (
                    <ResultImage
                      assetId={item.output_asset_id}
                      position={item.position}
                      prompt={job.prompt}
                    />
                  ) : (
                    <div className="generation-placeholder" role="status">
                      {item.status === "running" ? (
                        <>
                          <div className="generation-loading-icon">
                            <UiIcon icon={IconSparkles} size="illustration" />
                          </div>
                          <span>正在生成中</span>
                        </>
                      ) : (
                        statusLabel[item.status]
                      )}
                      {item.status === "failed" && (
                        <p role="alert">{errorLabel(item.error_code)}</p>
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
  const query = useImageHistory();
  const jobs = query.data?.pages.flatMap((page) => page.data) ?? [];
  const activeId = useStudioStore((s) => s.activeHistoryId);
  const setActiveId = useStudioStore((s) => s.setActiveHistoryId);
  const rail = useRef<HTMLElement>(null);
  const selectedId = jobs.some((job) => job.id === activeId) ? activeId : jobs[0]?.id;
  useEffect(() => {
    const container = rail.current;
    const selected = container?.querySelector<HTMLElement>('[aria-pressed="true"]');
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
      {jobs.length ? (
        jobs.map((job) => {
          const image = job.items.find((item) => item.output_asset_id)?.output_asset_id;
          return (
            <Button
              key={job.id}
              variant="tertiary"
              className="history-thumbnail"
              aria-label={`查看任务 ${job.id}`}
              aria-pressed={selectedId === job.id}
              onPress={() => {
                setActiveId(job.id);
                document
                  .getElementById(`job-${job.id}`)
                  ?.scrollIntoView({ block: "start", behavior: "instant" });
              }}
            >
              {image ? (
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

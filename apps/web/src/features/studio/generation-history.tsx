import { Button } from "@heroui/react";
import type { ImageJob } from "@lycoboai/contracts";
import { IconPhoto } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import { assetContentUrl, useImageHistory, useImageSession } from "./generation-client";

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
export function GenerationHistory({ compact = false }: { compact?: boolean }) {
  const session = useImageSession();
  const query = useImageHistory();
  const jobs = query.data?.pages.flatMap((page) => page.data) ?? [];
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
    <div className="generation-history">
      {jobs.map((job) => (
        <article className="generation-job" key={job.id} id={`job-${job.id}`}>
          <header>
            <strong>{job.model}</strong>
            <span role="status">{statusLabel[job.status]}</span>
            <time dateTime={job.created_at}>
              {new Date(job.created_at).toLocaleString("zh-CN")}
            </time>
          </header>
          <p className="generation-prompt">{job.prompt}</p>
          <small>
            {job.aspect_ratio} · {job.resolution} · {job.requested_count} 张
          </small>
          {job.status === "needs_reconciliation" && (
            <p role="alert">本次调用结果尚未确认，需要核对服务商记录，请勿重复生成。</p>
          )}
          {!compact && (
            <div className="generation-results">
              {job.items.map((item) => (
                <div key={item.id}>
                  {item.output_asset_id ? (
                    <>
                      <a
                        href={assetContentUrl(item.output_asset_id)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`查看原图 ${item.position + 1}`}
                      >
                        <img
                          src={assetContentUrl(item.output_asset_id, true)}
                          loading="lazy"
                          alt={`${job.prompt}，图片${item.position + 1}`}
                        />
                      </a>
                      <a
                        href={assetContentUrl(item.output_asset_id)}
                        download={`${item.output_asset_id}.png`}
                      >
                        下载原图
                      </a>
                      <small>
                        {item.width} × {item.height}
                      </small>
                    </>
                  ) : (
                    <div className="generation-placeholder" role="status">
                      {statusLabel[item.status]}
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
  return (
    <aside className="history-rail" aria-label="历史索引">
      <h2>历史</h2>
      {jobs.length ? (
        jobs.map((job) => {
          const image = job.items.find((item) => item.output_asset_id)?.output_asset_id;
          return (
            <a key={job.id} href={`#job-${job.id}`} aria-label={`查看任务 ${job.id}`}>
              {image ? (
                <img src={assetContentUrl(image, true)} alt={job.model} loading="lazy" />
              ) : (
                <span>{statusLabel[job.status]}</span>
              )}
            </a>
          );
        })
      ) : (
        <p>暂无记录</p>
      )}
    </aside>
  );
}

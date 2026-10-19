import { Button } from "@heroui/react";
import { IconFolder } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import { assetContentUrl, useImageAssets, useImageSession } from "./generation-client";

export function AssetsPage() {
  const session = useImageSession();
  const query = useImageAssets();
  const assets = query.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <section className="page-panel assets-page">
      <div className="page-heading">
        <div>
          <h1>素材库</h1>
          <p>已保存的生成图片与参考图片</p>
        </div>
      </div>
      {session.isError || query.isError ? (
        <div role="alert" className="generation-message">
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
      ) : session.isPending || query.isPending ? (
        <p role="status">正在加载素材…</p>
      ) : assets.length ? (
        <>
          <div className="asset-grid">
            {assets.map((asset) => (
              <article className="case-card" key={asset.id}>
                <a
                  className="asset-preview"
                  href={assetContentUrl(asset.id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img
                    src={assetContentUrl(asset.id, true)}
                    alt={asset.prompt ?? "参考图片"}
                    loading="lazy"
                  />
                </a>
                <div className="asset-card-details">
                  <h2>{asset.kind === "output" ? "生成图片" : "参考图片"}</h2>
                  <p>{asset.model}</p>
                  <small>
                    {asset.width} × {asset.height} ·{" "}
                    {new Date(asset.created_at).toLocaleString("zh-CN")}
                  </small>
                  <a href={assetContentUrl(asset.id)} download={`${asset.id}.png`}>
                    下载原图
                  </a>
                </div>
              </article>
            ))}
          </div>
          {query.hasNextPage && (
            <Button
              variant="secondary"
              isDisabled={query.isFetchingNextPage}
              onPress={() => {
                void query.fetchNextPage();
              }}
            >
              加载更多素材
            </Button>
          )}
        </>
      ) : (
        <div className="empty-state">
          <UiIcon icon={IconFolder} size="illustration" />
          <h2>还没有素材</h2>
          <p>生成成功的图片会自动保存在这里。</p>
        </div>
      )}
    </section>
  );
}

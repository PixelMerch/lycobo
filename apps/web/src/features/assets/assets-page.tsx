import { InfiniteLoad } from "../../components/infinite-load";
import { AssetImage } from "../generation/asset-image";
import "./image-public-id.css";
import { Button, Card, EmptyState, Link } from "@heroui/react";
import { IconFolder } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import { useErrorToast } from "../../lib/error-toast";
import {
  assetContentUrl,
  downloadAsset,
  useImageAssets,
  useImageSession,
} from "../generation/generation-client";
import { modelDisplayName } from "../generation/models/model-display-name";
import { useModelPresentation } from "../generation/models/model-logos";

export function AssetsPage() {
  const session = useImageSession();
  const models = useModelPresentation().data?.models ?? [];
  const query = useImageAssets({ kind: "output", type: "image" });
  const assets =
    query.data?.pages.flatMap((page) => page.data).filter((asset) => asset.kind === "output") ?? [];
  useErrorToast(
    session.isError || query.isError
      ? (session.error?.message ?? query.error?.message ?? "服务暂时不可用，请稍后重试。")
      : null,
  );
  return (
    <section className="page-panel assets-page">
      <div className="page-heading">
        <div>
          <h1>素材库</h1>
          <p>已生成的图片</p>
        </div>
      </div>
      {session.isError ||
      (query.isError && !query.data) ||
      session.isPending ||
      query.isPending ? null : assets.length ? (
        <>
          <div className="asset-grid">
            {assets.map((asset) => (
              <Card className="case-card" key={asset.id} variant="transparent">
                <Link
                  className="asset-preview"
                  href={assetContentUrl(asset.id)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`查看原图：${asset.prompt ?? "参考图片"}`}
                >
                  <AssetImage
                    assetId={asset.id}
                    thumbnail
                    alt={asset.prompt ?? "参考图片"}
                    loading="lazy"
                  />
                </Link>
                <Card.Content className="asset-card-details">
                  <Card.Title>{asset.kind === "output" ? "生成图片" : "参考图片"}</Card.Title>
                  <Card.Description>{modelDisplayName(asset.model, models)}</Card.Description>
                  {asset.public_id && <p className="image-public-id">图片 ID：{asset.public_id}</p>}
                  <small>
                    {asset.width} × {asset.height} ·{" "}
                    {new Date(asset.created_at).toLocaleString("zh-CN")}
                  </small>
                  <Button variant="outline" size="sm" onPress={() => downloadAsset(asset.id)}>
                    下载原图
                  </Button>
                </Card.Content>
              </Card>
            ))}
          </div>
          <InfiniteLoad
            hasMore={query.hasNextPage}
            isLoading={query.isFetchingNextPage}
            isError={query.isError}
            onLoadMore={() => query.fetchNextPage({ cancelRefetch: false })}
          />
        </>
      ) : (
        <EmptyState className="empty-state">
          <UiIcon icon={IconFolder} size="illustration" />
          <h2>还没有素材</h2>
          <p>生成成功的图片会自动保存在这里。</p>
        </EmptyState>
      )}
    </section>
  );
}

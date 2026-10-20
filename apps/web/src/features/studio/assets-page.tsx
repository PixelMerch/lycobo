import "./image-public-id.css";
import { Alert, Button, Card, EmptyState, Link, Spinner } from "@heroui/react";
import { IconFolder } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import {
  assetContentUrl,
  downloadAsset,
  useImageAssets,
  useImageSession,
} from "./generation-client";

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
      ) : session.isPending || query.isPending ? (
        <p className="generation-message" role="status">
          <Spinner aria-hidden size="sm" />
          正在加载素材…
        </p>
      ) : assets.length ? (
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
                  <img
                    src={assetContentUrl(asset.id, true)}
                    alt={asset.prompt ?? "参考图片"}
                    loading="lazy"
                  />
                </Link>
                <Card.Content className="asset-card-details">
                  <Card.Title>{asset.kind === "output" ? "生成图片" : "参考图片"}</Card.Title>
                  <Card.Description>{asset.model}</Card.Description>
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
        <EmptyState className="empty-state">
          <UiIcon icon={IconFolder} size="illustration" />
          <h2>还没有素材</h2>
          <p>生成成功的图片会自动保存在这里。</p>
        </EmptyState>
      )}
    </section>
  );
}

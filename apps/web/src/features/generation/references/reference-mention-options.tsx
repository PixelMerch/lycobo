import { Button, Input, ListBox, Tabs, TextField } from "@heroui/react";
import { useState } from "react";
import { InfiniteLoad } from "../../../components/infinite-load";
import { assetContentUrl } from "../asset-delivery-client";
import { useImageAssets } from "../generation-client";
import type { ReferenceImage } from "../studio-state";

/** Browse only the authenticated user's assets; selecting an asset reuses its durable ID. */
function mentionAssetKind(category: string) {
  if (category === "images") return "reference";
  return category === "favorites" ? "all" : "output";
}

function alreadyUsed(image: ReferenceImage, usedIds: Set<string>) {
  return usedIds.has(image.id) || Boolean(image.assetId && usedIds.has(image.assetId));
}

export function ReferenceMentionOptions({
  references,
  maxReferences = 5,
  usedIds,
  onSelect,
  allowHistory,
}: {
  maxReferences?: number;
  references: readonly {
    id: string;
    src: string;
    name?: string;
    assetId?: string;
    sourceKind?: "reference" | "output";
  }[];
  usedIds: Set<string>;
  onSelect: (images: ReferenceImage[]) => void;
  allowHistory: boolean;
}) {
  const [category, setCategory] = useState("images");
  const [search, setSearch] = useState("");
  const isCurrent = (image: ReferenceImage) =>
    references.some(
      (reference) =>
        reference.id === image.id || (image.assetId && reference.assetId === image.assetId),
    );
  // 收藏 lists the member's server favorites, uploads and outputs alike.
  const query = useImageAssets({
    enabled: allowHistory,
    kind: mentionAssetKind(category),
    type: "image",
    favorite: category === "favorites",
  });
  const assets = query.data?.pages.flatMap((page) => page.data) ?? [];
  const stored: ReferenceImage[] = assets.map((asset) => ({
    id: asset.id,
    assetId: asset.id,
    sourceKind: asset.kind,
    src: assetContentUrl(asset.id, true),
    name: asset.public_id ?? (asset.kind === "output" ? "生成图片" : "上传图片"),
  }));
  const options: ReferenceImage[] =
    category === "images"
      ? [
          ...references
            .filter((image) => image.sourceKind !== "output")
            .map((image, index) => ({
              ...image,
              name: image.name ?? `图片${index + 1}`,
            })),
          ...stored.filter((image) => !isCurrent(image)),
        ]
      : stored;
  const keyword = search.trim().toLocaleLowerCase();
  const filtered = options.filter((image, index) =>
    `${image.name} ${image.id} 图片${index + 1} ${assets.find((asset) => asset.id === image.id)?.prompt ?? ""}`
      .toLocaleLowerCase()
      .includes(keyword),
  );
  const disabled = options
    .filter(
      (image) =>
        alreadyUsed(image, usedIds) || (!isCurrent(image) && references.length >= maxReferences),
    )
    .map((image) => image.id);
  const emptyLabel = allowHistory && query.isError ? "图片暂时无法加载" : "暂无匹配图片";
  const loading = allowHistory && query.isFetching;
  return (
    <div className="reference-mention-options">
      <Tabs
        className="reference-source-tabs"
        selectedKey={category}
        onSelectionChange={(key) => {
          setCategory(String(key));
          setSearch("");
        }}
        variant="secondary"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="图片来源">
            <Tabs.Tab id="images">
              图片
              <Tabs.Indicator />
            </Tabs.Tab>
            {allowHistory && (
              <Tabs.Tab id="generated">
                素材
                <Tabs.Indicator />
              </Tabs.Tab>
            )}
            {allowHistory && (
              <Tabs.Tab id="favorites">
                收藏
                <Tabs.Indicator />
              </Tabs.Tab>
            )}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      <TextField aria-label="搜索图片" value={search} onChange={setSearch}>
        <Input placeholder="搜索图片 ID、描述或名称" />
      </TextField>
      <div className="reference-mention-scroll">
        {filtered.length ? (
          <ListBox
            aria-label="可引用图片"
            disabledKeys={disabled}
            onAction={(key) => {
              const image = filtered.find((item) => item.id === key);
              if (image) onSelect([image]);
            }}
          >
            {filtered.map((image) => (
              <ListBox.Item key={image.id} id={image.id} textValue={image.name}>
                <img src={image.src} alt="" loading="lazy" />
                <span>{image.name}</span>
                {alreadyUsed(image, usedIds) ? <small>已引用</small> : null}
              </ListBox.Item>
            ))}
          </ListBox>
        ) : (
          <p className="reference-mention-empty">{!loading && emptyLabel}</p>
        )}
        {allowHistory && query.isError && (
          <Button size="sm" variant="ghost" onPress={() => void query.refetch()}>
            重新加载
          </Button>
        )}
        {allowHistory && (
          <InfiniteLoad
            hasMore={query.hasNextPage}
            isLoading={query.isFetching}
            isError={query.isError}
            onLoadMore={() => query.fetchNextPage({ cancelRefetch: false })}
          />
        )}
      </div>
    </div>
  );
}

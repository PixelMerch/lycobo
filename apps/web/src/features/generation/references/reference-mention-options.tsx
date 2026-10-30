import { Button, Input, ListBox, Tabs, TextField } from "@heroui/react";
import { useState } from "react";
import { InfiniteLoad } from "../../../components/infinite-load";
import { assetContentUrl } from "../asset-delivery-client";
import { useImageAssets } from "../generation-client";
import type { ReferenceImage } from "../studio-state";

/** Browse only the authenticated user's assets; selecting an asset reuses its durable ID. */
export function ReferenceMentionOptions({
  references,
  usedIds,
  onSelect,
  allowHistory,
}: {
  references: readonly { id: string; src: string; name?: string; assetId?: string }[];
  usedIds: Set<string>;
  onSelect: (images: ReferenceImage[]) => void;
  allowHistory: boolean;
}) {
  const [category, setCategory] = useState("current");
  const [search, setSearch] = useState("");
  const isCurrent = (image: ReferenceImage) =>
    references.some(
      (reference) =>
        reference.id === image.id || (image.assetId && reference.assetId === image.assetId),
    );
  const query = useImageAssets({
    enabled: allowHistory && category !== "current",
    kind: category === "uploaded" ? "reference" : "output",
    type: "image",
  });
  const assets = query.data?.pages.flatMap((page) => page.data) ?? [];
  const options: ReferenceImage[] =
    category === "current"
      ? references.map((image, index) => ({ ...image, name: image.name ?? `图片${index + 1}` }))
      : assets.map((asset) => ({
          id: asset.id,
          assetId: asset.id,
          src: assetContentUrl(asset.id, true),
          name:
            asset.public_id ??
            `${asset.kind === "output" ? "生成图片" : "上传图片"} · ${new Date(asset.created_at).toLocaleString("zh-CN")}`,
        }));
  const keyword = search.trim().toLocaleLowerCase();
  const filtered = options.filter((image, index) =>
    `${image.name} ${image.id} 图片${index + 1} ${assets.find((asset) => asset.id === image.id)?.prompt ?? ""}`
      .toLocaleLowerCase()
      .includes(keyword),
  );
  const disabled = options
    .filter(
      (image) =>
        usedIds.has(image.id) ||
        (image.assetId && usedIds.has(image.assetId)) ||
        (!isCurrent(image) && references.length >= 5),
    )
    .map((image) => image.id);
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
            <Tabs.Tab id="current">
              当前图片
              <Tabs.Indicator />
            </Tabs.Tab>
            {allowHistory && (
              <Tabs.Tab id="uploaded">
                历史上传
                <Tabs.Indicator />
              </Tabs.Tab>
            )}
            {allowHistory && (
              <Tabs.Tab id="generated">
                生成图片
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
                {usedIds.has(image.id) || (image.assetId && usedIds.has(image.assetId)) ? (
                  <small>已引用</small>
                ) : null}
              </ListBox.Item>
            ))}
          </ListBox>
        ) : (
          <p className="reference-mention-empty">
            {category !== "current" && query.isFetching
              ? null
              : category !== "current" && query.isError
                ? "图片暂时无法加载"
                : "暂无匹配图片"}
          </p>
        )}
        {category !== "current" && query.isError && (
          <Button size="sm" variant="ghost" onPress={() => void query.refetch()}>
            重新加载
          </Button>
        )}
        {category !== "current" && (
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

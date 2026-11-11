import { Button, Input, ListBox, Tabs, TextField } from "@heroui/react";
import { useState } from "react";
import { InfiniteLoad } from "../../../components/infinite-load";
import { useMessages } from "../../../i18n/messages";
import { assetContentUrl } from "../asset-delivery-client";
import { useImageAssets } from "../generation-client";
import type { ReferenceImage } from "../studio-state";
import { referencesMessages } from "./references-messages";

/** Browse only the authenticated user's assets; selecting an asset reuses its durable ID. */
function mentionAssetKind(category: string) {
  if (category === "images") return "reference";
  return category === "favorites" ? "all" : "output";
}

function alreadyUsed(image: ReferenceImage, usedIds: Set<string>) {
  return usedIds.has(image.id) || Boolean(image.assetId && usedIds.has(image.assetId));
}

/** @ 引用菜单：从当前图片、素材与收藏里选择要引用的图片。 */
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
  const t = useMessages(referencesMessages);
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
    name: asset.public_id ?? (asset.kind === "output" ? t.generatedImage : t.uploadedImage),
  }));
  const options: ReferenceImage[] =
    category === "images"
      ? [
          ...references
            .filter((image) => image.sourceKind !== "output")
            .map((image, index) => ({
              ...image,
              name: image.name ?? t.imageName(index + 1),
            })),
          ...stored.filter((image) => !isCurrent(image)),
        ]
      : stored;
  const keyword = search.trim().toLocaleLowerCase();
  const filtered = options.filter((image, index) =>
    `${image.name} ${image.id} ${t.imageName(index + 1)} ${assets.find((asset) => asset.id === image.id)?.prompt ?? ""}`
      .toLocaleLowerCase()
      .includes(keyword),
  );
  const disabled = options
    .filter(
      (image) =>
        alreadyUsed(image, usedIds) || (!isCurrent(image) && references.length >= maxReferences),
    )
    .map((image) => image.id);
  const emptyLabel = allowHistory && query.isError ? t.loadFailed : t.noMatches;
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
          <Tabs.List aria-label={t.sources}>
            <Tabs.Tab id="images">
              {t.images}
              <Tabs.Indicator />
            </Tabs.Tab>
            {allowHistory && (
              <Tabs.Tab id="generated">
                {t.assets}
                <Tabs.Indicator />
              </Tabs.Tab>
            )}
            {allowHistory && (
              <Tabs.Tab id="favorites">
                {t.favorites}
                <Tabs.Indicator />
              </Tabs.Tab>
            )}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      <TextField aria-label={t.search} value={search} onChange={setSearch}>
        <Input placeholder={t.searchPlaceholder} />
      </TextField>
      <div className="reference-mention-scroll">
        {filtered.length ? (
          <ListBox
            aria-label={t.selectable}
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
                {alreadyUsed(image, usedIds) ? <small>{t.alreadyUsed}</small> : null}
              </ListBox.Item>
            ))}
          </ListBox>
        ) : (
          <p className="reference-mention-empty">{!loading && emptyLabel}</p>
        )}
        {allowHistory && query.isError && (
          <Button size="sm" variant="ghost" onPress={() => void query.refetch()}>
            {t.reload}
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

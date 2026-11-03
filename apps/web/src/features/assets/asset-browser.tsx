import { Button, EmptyState, Tabs } from "@heroui/react";
import type { ImageAsset, ImageTool } from "@lycoboai/contracts";
import {
  IconMovie,
  IconPhoto,
  IconPhotoSearch,
  IconPhotoX,
  IconStar,
  type TablerIcon,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { InfiniteLoad } from "../../components/infinite-load";
import { UiIcon } from "../../components/ui-icon";
import { useErrorToast } from "../../lib/error-toast";
import { useImageSession } from "../generation/generation-client";
import { modelDisplayName } from "../generation/models/model-display-name";
import { useModelPresentation } from "../generation/models/model-logos";
import { ImagePreviewDialog } from "../image-workspace/image-preview";
import { AssetFilters, toolNames } from "./asset-filters";
import { aspectRatio, dayHeading, groupByDay, justifyRows, masonryColumns } from "./asset-layout";
import {
  type AssetLibraryFilters,
  type AssetSource,
  defaultAssetFilters,
  sameFilters,
  useAssetLibrary,
} from "./asset-library-client";
import { AssetTile } from "./asset-tile";
import "./asset-browser.css";

const sources: { id: AssetSource; label: string }[] = [
  { id: "generated", label: "生成" },
  { id: "uploads", label: "上传" },
  { id: "favorites", label: "收藏" },
];
// Desktop rows share this height; narrow containers switch to a two-column masonry.
const rowHeight = 220;
const rowGap = 12;
const compactWidth = 720;

function useWidth() {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry?.contentRect.width ?? 0)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return [setElement, width] as const;
}

type Empty = {
  icon: TablerIcon;
  title: string;
  text: string;
  action?: { label: string; filters: AssetLibraryFilters };
};
function emptyState(
  filters: AssetLibraryFilters,
  defaults: AssetLibraryFilters,
  currentTool: ImageTool | undefined,
): Empty {
  const reset = { ...defaults, source: filters.source };
  if (filters.type === "video")
    return {
      icon: IconMovie,
      title: "暂无视频素材",
      text: "当前筛选下没有视频，可切换到图片查看。",
      action: { label: "查看图片", filters: { ...filters, type: "image" } },
    };
  if (filters.source === "uploads")
    return { icon: IconPhoto, title: "还没有上传的素材", text: "生成时上传的参考图会保存在这里。" };
  // 我的素材 starts on its tool; an empty default view offers every tool instead.
  if (
    currentTool &&
    filters.tool === currentTool &&
    filters.type === "all" &&
    filters.model === "all"
  )
    return filters.source === "favorites"
      ? {
          icon: IconStar,
          title: `${toolNames[currentTool]}还没有收藏的素材`,
          text: "在图片预览或生成结果中点击星标即可收藏。",
          action: { label: "查看全部收藏", filters: { ...filters, tool: "all" } },
        }
      : {
          icon: IconPhoto,
          title: `${toolNames[currentTool]}还没有素材`,
          text: "生成成功的图片会自动保存在这里。",
          action: { label: "查看全部功能的素材", filters: { ...filters, tool: "all" } },
        };
  if (!sameFilters(filters, { ...defaultAssetFilters, source: filters.source }))
    return {
      icon: IconPhotoSearch,
      title: "没有符合筛选的素材",
      text: "调整功能、类型或模型筛选后再试。",
      ...(sameFilters(filters, reset) ? {} : { action: { label: "重置筛选", filters: reset } }),
    };
  if (filters.source === "favorites")
    return {
      icon: IconStar,
      title: "还没有收藏的素材",
      text: "在图片预览或生成结果中点击星标即可收藏。",
    };
  return { icon: IconPhoto, title: "还没有生成的素材", text: "生成成功的图片会自动保存在这里。" };
}

function AssetEmpty({
  icon,
  title,
  text,
  action,
}: {
  icon: TablerIcon;
  title: string;
  text: string;
  action?: { label: string; onPress: () => void } | undefined;
}) {
  return (
    <EmptyState className="asset-empty">
      <span className="asset-empty-icon">
        <UiIcon icon={icon} size="illustration" />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action && (
        <Button size="sm" variant="secondary" onPress={action.onPress}>
          {action.label}
        </Button>
      )}
    </EmptyState>
  );
}

function Skeleton({ compact }: { compact: boolean }) {
  const blocks = compact ? [180, 132, 150, 210] : [176, 132, 264, 220, 176, 300];
  return (
    <div className="asset-skeleton" aria-hidden="true" data-compact={compact || undefined}>
      {blocks.map((width, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders never reorder.
        <span key={index} style={compact ? { height: width } : { width }} />
      ))}
    </div>
  );
}

const toPreview = (asset: ImageAsset) => ({
  id: asset.id,
  publicId: asset.public_id,
  width: asset.width,
  height: asset.height,
  meta: {
    taskPublicId: asset.task_public_id,
    model: asset.model,
    createdAt: asset.created_at,
    prompt: asset.prompt,
    imagePublicId: asset.public_id,
  },
});

/**
 * 素材库 and 我的素材 share one browser: 生成 / 上传 / 收藏, then 功能 / 类型 / 模型 filters,
 * newest-first day groups and the existing image preview.
 */
export function AssetBrowser({
  filters,
  defaults,
  currentTool,
  headingLevel,
  onChange,
  onViewHistory,
}: {
  filters: AssetLibraryFilters;
  defaults: AssetLibraryFilters;
  currentTool?: ImageTool | undefined;
  headingLevel: 2 | 3;
  onChange: (filters: AssetLibraryFilters) => void;
  onViewHistory?: (() => void) | undefined;
}) {
  const session = useImageSession();
  const query = useAssetLibrary(filters);
  const models = useModelPresentation().data?.models ?? [];
  const [frame, width] = useWidth();
  const [preview, setPreview] = useState<number | null>(null);
  // The list waits for the image session, so a failed session is the list's failure too.
  const failure = session.isError
    ? session.error
    : query.isError && !query.data
      ? query.error
      : null;
  useErrorToast(
    session.isError ? session.error.message : query.isError ? query.error.message : null,
  );
  const compact = width > 0 && width < compactWidth;
  const assets = query.data?.pages.flatMap((page) => page.data) ?? [];
  const index = new Map(assets.map((asset, position) => [asset.id, position]));
  const Day = headingLevel === 2 ? "h2" : "h3";
  const tile = (
    asset: ImageAsset,
    style: { width?: number; height?: number; aspectRatio?: number },
  ) => (
    <AssetTile
      key={asset.id}
      asset={asset}
      modelName={modelDisplayName(asset.model, models)}
      style={style}
      onOpen={() => setPreview(index.get(asset.id) ?? 0)}
    />
  );
  const empty = emptyState(filters, defaults, currentTool);
  const content = failure ? (
    <AssetEmpty
      icon={IconPhotoX}
      title="素材暂时不可用"
      text={failure.message || "请检查网络后重新加载。"}
      action={{
        label: "重新加载",
        onPress: () => void (session.isError ? session.refetch() : query.refetch()),
      }}
    />
  ) : query.isPending ? (
    <Skeleton compact={compact} />
  ) : assets.length === 0 ? (
    <AssetEmpty
      icon={empty.icon}
      title={empty.title}
      text={empty.text}
      action={
        empty.action && {
          label: empty.action.label,
          onPress: () => empty.action && onChange(empty.action.filters),
        }
      }
    />
  ) : (
    <>
      {groupByDay(assets).map((group) => {
        const heading = dayHeading(group.first);
        return (
          <section key={group.key} className="asset-day-group" aria-label={heading.label}>
            <Day className="asset-day">
              <b>{heading.label}</b>
              <span>{heading.detail}</span>
            </Day>
            {compact ? (
              <div className="asset-masonry">
                {masonryColumns(group.items, 2).map((column, position) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the two columns are fixed slots.
                  <div key={position} className="asset-column">
                    {column.map((asset) => tile(asset, { aspectRatio: aspectRatio(asset) }))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="asset-rows">
                {justifyRows(group.items, width, rowHeight, rowGap).map((row) => (
                  <div
                    key={row.items[0]?.item.id}
                    className="asset-row"
                    style={{ height: row.height }}
                  >
                    {row.items.map((entry) => tile(entry.item, { width: entry.width }))}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
      <InfiniteLoad
        hasMore={query.hasNextPage}
        isLoading={query.isFetchingNextPage}
        isError={query.isError}
        onLoadMore={() => query.fetchNextPage({ cancelRefetch: false })}
      />
    </>
  );
  return (
    <div className="asset-browser" ref={frame}>
      <Tabs
        selectedKey={filters.source}
        onSelectionChange={(key) => {
          const source = sources.find((entry) => entry.id === key)?.id;
          if (source) onChange({ ...filters, source });
        }}
        className="asset-source-tabs"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="素材来源">
            {sources.map((source) => (
              <Tabs.Tab key={source.id} id={source.id}>
                {source.label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        {sources.map((source) => (
          <Tabs.Panel key={source.id} id={source.id} className="asset-source-panel">
            <AssetFilters
              filters={filters}
              defaults={defaults}
              currentTool={currentTool}
              models={models}
              loaded={query.data ? assets.length : null}
              compact={compact}
              onChange={onChange}
            />
            {width > 0 && content}
          </Tabs.Panel>
        ))}
      </Tabs>
      {preview !== null && (
        <ImagePreviewDialog
          images={assets.map(toPreview)}
          initialIndex={preview}
          onClose={() => setPreview(null)}
          hasMore={query.hasNextPage}
          isLoadingMore={query.isFetchingNextPage}
          isLoadMoreError={query.isError}
          onLoadMore={() => query.fetchNextPage({ cancelRefetch: false })}
          {...(onViewHistory ? { onViewHistory } : {})}
        />
      )}
    </div>
  );
}

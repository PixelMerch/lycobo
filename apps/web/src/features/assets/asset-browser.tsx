import { Button, EmptyState, Tabs, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import type { ImageAsset, ImageTool } from "@lycoboai/contracts";
import {
  IconGrid4x4,
  IconGridDots,
  IconLayoutGrid,
  IconMovie,
  IconPhoto,
  IconPhotoSearch,
  IconPhotoX,
  IconStar,
  type TablerIcon,
} from "@tabler/icons-react";
import { type CSSProperties, useEffect, useState } from "react";
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

type Empty = { icon: TablerIcon; title: string };
function emptyState(
  filters: AssetLibraryFilters,
  defaults: AssetLibraryFilters,
  currentTool: ImageTool | undefined,
): Empty {
  if (filters.type === "video") return { icon: IconMovie, title: "暂无视频素材" };
  if (filters.source === "uploads") return { icon: IconPhoto, title: "还没有上传的素材" };
  if (
    currentTool &&
    filters.tool === currentTool &&
    filters.type === defaults.type &&
    filters.model === "all" &&
    (!filters.time || filters.time === "all")
  )
    return filters.source === "favorites"
      ? { icon: IconStar, title: `${toolNames[currentTool]}还没有收藏的素材` }
      : { icon: IconPhoto, title: `${toolNames[currentTool]}还没有素材` };
  if (
    !sameFilters(filters, { ...defaultAssetFilters, source: filters.source, type: defaults.type })
  )
    return { icon: IconPhotoSearch, title: "没有符合筛选的素材" };
  if (filters.source === "favorites") return { icon: IconStar, title: "还没有收藏的素材" };
  return { icon: IconPhoto, title: "还没有生成的素材" };
}

function AssetEmpty({
  icon,
  title,
  text,
  action,
}: {
  icon: TablerIcon;
  title: string;
  text?: string;
  action?: { label: string; onPress: () => void } | undefined;
}) {
  return (
    <EmptyState className="asset-empty">
      <span className="asset-empty-icon">
        <UiIcon icon={icon} size="illustration" />
      </span>
      {text ? (
        <>
          <h2>{title}</h2>
          <p>{text}</p>
        </>
      ) : (
        <p>{title}</p>
      )}
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
  generatedOnly = false,
  onChange,
  onViewHistory,
}: {
  filters: AssetLibraryFilters;
  defaults: AssetLibraryFilters;
  currentTool?: ImageTool | undefined;
  headingLevel: 2 | 3;
  generatedOnly?: boolean;
  onChange: (filters: AssetLibraryFilters) => void;
  onViewHistory?: (() => void) | undefined;
}) {
  const [columns, setColumns] = useState(6);
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
  const densityGrid = (items: ImageAsset[]) => (
    <div className="asset-density-grid" style={{ "--asset-columns": columns } as CSSProperties}>
      {items.map((asset) => tile(asset, { aspectRatio: 1 }))}
    </div>
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
    <AssetEmpty icon={empty.icon} title={empty.title} />
  ) : (
    <>
      {generatedOnly && (!filters.time || filters.time === "all")
        ? densityGrid(assets)
        : groupByDay(assets).map((group) => {
            const heading = dayHeading(group.first);
            return (
              <section key={group.key} className="asset-day-group" aria-label={heading.label}>
                <Day className="asset-day">
                  <b>{heading.label}</b>
                  <span>{heading.detail}</span>
                </Day>
                {generatedOnly ? (
                  densityGrid(group.items)
                ) : compact ? (
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
  const panelContent = (
    <>
      <AssetFilters
        filters={filters}
        defaults={defaults}
        currentTool={currentTool}
        models={models}
        loaded={query.data ? assets.length : null}
        compact={compact}
        mediaSelect={generatedOnly}
        displayControls={
          generatedOnly ? (
            <ToggleButtonGroup
              aria-label="图片大小"
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[String(columns)]}
              onSelectionChange={(keys) => {
                const count = [6, 8, 10].find((value) => keys.has(String(value)));
                if (count) setColumns(count);
              }}
              className="asset-segment asset-density-control"
              size="sm"
            >
              <ToggleButton isIconOnly id="6" aria-label="大图，每行6张">
                <UiIcon icon={IconLayoutGrid} />
              </ToggleButton>
              <ToggleButton isIconOnly id="8" aria-label="中图，每行8张">
                <UiIcon icon={IconGridDots} />
              </ToggleButton>
              <ToggleButton isIconOnly id="10" aria-label="小图，每行10张">
                <UiIcon icon={IconGrid4x4} />
              </ToggleButton>
            </ToggleButtonGroup>
          ) : undefined
        }
        onChange={onChange}
      />
      {width > 0 && content}
    </>
  );
  return (
    <div className="asset-browser" ref={frame}>
      {generatedOnly ? (
        <div className="asset-source-panel">{panelContent}</div>
      ) : (
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
              {panelContent}
            </Tabs.Panel>
          ))}
        </Tabs>
      )}
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

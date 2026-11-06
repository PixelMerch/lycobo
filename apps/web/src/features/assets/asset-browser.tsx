import { Button, EmptyState, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import type { AssetTool, ImageAsset } from "@lycoboai/contracts";
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
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router";
import { InfiniteLoad } from "../../components/infinite-load";
import { UiIcon } from "../../components/ui-icon";
import { useErrorToast } from "../../lib/error-toast";
import { loginHref } from "../auth/login-navigation";
import { ImageApiError, useImageSession } from "../generation/generation-client";
import { useModelPresentation } from "../generation/models/model-logos";
import { AssetFilters, assetToolName } from "./asset-filters";
import { dayHeading, groupByDay } from "./asset-layout";
import {
  type AssetLibraryFilters,
  defaultAssetFilters,
  sameFilters,
  useAssetLibrary,
} from "./asset-library-client";
import { AssetMasonry } from "./asset-masonry";
import { AssetPreview } from "./asset-preview";
import "./asset-browser.css";

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
  currentTool: AssetTool | undefined,
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
      ? { icon: IconStar, title: `${assetToolName(currentTool)}还没有收藏的素材` }
      : { icon: IconPhoto, title: `${assetToolName(currentTool)}还没有素材` };
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

/** 素材库与我的素材共用筛选、分页与预览，认证过期时前往登录页。 */
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
  currentTool?: AssetTool | undefined;
  headingLevel: 2 | 3;
  generatedOnly?: boolean;
  onChange: (filters: AssetLibraryFilters) => void;
  onViewHistory?: (() => void) | undefined;
}) {
  const location = useLocation();
  const [columns, setColumns] = useState(8);
  const session = useImageSession();
  const query = useAssetLibrary(filters);
  const models = useModelPresentation().data?.models ?? [];
  const [frame, width] = useWidth();
  const [preview, setPreview] = useState<number | null>(null);
  const { failure, authenticationRequired } = useAssetStatus(session, query);
  const compact = width > 0 && width < compactWidth;
  const assets = query.data?.pages.flatMap((page) => page.data) ?? [];
  if (authenticationRequired)
    return (
      <Navigate
        to={`${loginHref(`${location.pathname}${location.search}${location.hash}`)}&reauth=1`}
        replace
      />
    );

  return (
    <div className="asset-browser" ref={frame}>
      <div className="asset-source-panel">
        <AssetFilters
          filters={filters}
          defaults={defaults}
          currentTool={currentTool}
          models={models}
          loaded={query.data ? assets.length : null}
          compact={compact}
          mediaSelect
          showSource={!generatedOnly}
          displayControls={<AssetDensityControls columns={columns} onChange={setColumns} />}
          onChange={onChange}
        />
        {width > 0 && (
          <AssetResults
            assets={assets}
            columns={columns}
            compact={compact}
            headingLevel={headingLevel}
            filters={filters}
            empty={emptyState(filters, defaults, currentTool)}
            models={models}
            onOpen={setPreview}
            query={query}
            failure={failure}
            retry={() => void (session.isError ? session.refetch() : query.refetch())}
          />
        )}
      </div>
      {preview !== null && (
        <AssetPreview
          assets={assets}
          index={preview}
          query={query}
          onClose={() => setPreview(null)}
          onViewHistory={onViewHistory}
        />
      )}
    </div>
  );
}

type AssetQuery = ReturnType<typeof useAssetLibrary>;

function useAssetStatus(session: ReturnType<typeof useImageSession>, query: AssetQuery) {
  // The list waits for the image session, so a failed session is the list's failure too.
  const initialQueryFailure = query.isError && !query.data ? query.error : null;
  const failure = session.isError ? session.error : initialQueryFailure;
  const authenticationRequired =
    (session.error instanceof ImageApiError && session.error.status === 401) ||
    (query.error instanceof ImageApiError && query.error.status === 401);
  const message = (session.error ?? query.error)?.message;
  useErrorToast(authenticationRequired ? null : message);
  return { failure, authenticationRequired };
}

function AssetResults({
  assets,
  columns,
  compact,
  headingLevel,
  filters,
  empty,
  models,
  onOpen,
  query,
  failure,
  retry,
}: {
  assets: ImageAsset[];
  columns: number;
  compact: boolean;
  headingLevel: 2 | 3;
  filters: AssetLibraryFilters;
  empty: Empty;
  models: NonNullable<ReturnType<typeof useModelPresentation>["data"]>["models"];
  onOpen: (index: number) => void;
  query: AssetQuery;
  failure: Error | null;
  retry: () => void;
}) {
  const index = new Map(assets.map((asset, position) => [asset.id, position]));
  const Day = headingLevel === 2 ? "h2" : "h3";
  const densityGrid = (items: ImageAsset[]) => (
    <AssetMasonry
      assets={items}
      columns={columns}
      models={models}
      onOpen={(asset) => onOpen(index.get(asset.id) ?? 0)}
    />
  );
  if (failure)
    return (
      <AssetEmpty
        icon={IconPhotoX}
        title="素材暂时不可用"
        text={failure.message || "请检查网络后重新加载。"}
        action={{
          label: "重新加载",
          onPress: retry,
        }}
      />
    );
  if (query.isPending) return <Skeleton compact={compact} />;
  if (!assets.length) return <AssetEmpty icon={empty.icon} title={empty.title} />;
  return (
    <>
      {!filters.time || filters.time === "all"
        ? densityGrid(assets)
        : groupByDay(assets).map((group) => {
            const heading = dayHeading(group.first);
            return (
              <section key={group.key} className="asset-day-group" aria-label={heading.label}>
                <Day className="asset-day">
                  <b>{heading.label}</b>
                  <span>{heading.detail}</span>
                </Day>
                {densityGrid(group.items)}
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
}

function AssetDensityControls({
  columns,
  onChange,
}: {
  columns: number;
  onChange: (columns: number) => void;
}) {
  return (
    <ToggleButtonGroup
      aria-label="图片大小"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[String(columns)]}
      onSelectionChange={(keys) => {
        const count = [6, 8, 10].find((value) => keys.has(String(value)));
        if (count) onChange(count);
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
  );
}

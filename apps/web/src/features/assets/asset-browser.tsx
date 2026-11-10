import { Button, EmptyState } from "@heroui/react";
import type { AssetTool, ImageAsset } from "@lycoboai/contracts";
import {
  IconMovie,
  IconPhoto,
  IconPhotoSearch,
  IconPhotoX,
  IconStar,
  type TablerIcon,
} from "@tabler/icons-react";
import { type ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router";
import { InfiniteLoad } from "../../components/infinite-load";
import { UiIcon } from "../../components/ui-icon";
import { useErrorToast } from "../../lib/error-toast";
import { loginHref } from "../auth/login-navigation";
import { ImageApiError, useImageSession } from "../generation/generation-client";
import { AssetFilters, assetToolName } from "./asset-filters";
import { dayHeading, groupByDay } from "./asset-layout";
import { type AssetLibraryFilters, useAssetLibrary } from "./asset-library-client";
import { AssetMasonry } from "./asset-masonry";
import { AssetPreview } from "./asset-preview";
import { type AssetSelection, AssetSelectionControls, useAssetSelection } from "./asset-selection";
import "./asset-browser.css";
import type { Locale } from "../../i18n/locale";
import { useLocale } from "../../i18n/locale-store";
import { useMessages } from "../../i18n/messages";
import { assetsMessages } from "./assets-messages";

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

/** 空列表的说明跟着筛选走：时间范围、收藏、视频、上传、某个功能，各说各的。 */
function emptyState(filters: AssetLibraryFilters, locale: Locale): Empty {
  const t = assetsMessages[locale];
  const tool =
    filters.source === "generated" && filters.tool !== "all"
      ? assetToolName(filters.tool, locale)
      : null;
  if (filters.time !== "all") return { icon: IconPhotoSearch, title: t.noMatches };
  if (filters.favorite)
    return { icon: IconStar, title: tool ? t.noToolFavorites(tool) : t.noFavorites };
  if (filters.type === "video") return { icon: IconMovie, title: t.noVideos };
  if (filters.source === "uploads") return { icon: IconPhoto, title: t.noUploads };
  if (tool) return { icon: IconPhoto, title: t.noToolAssets(tool) };
  if (filters.source === "generated") return { icon: IconPhoto, title: t.noGenerated };
  return { icon: IconPhoto, title: t.noAssets };
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

/**
 * 我的素材：筛选、按天分组的瀑布流、多选批量下载与预览，弹窗和素材库页面共用；认证过期时前往登录页。
 * 换筛选时退出多选，因为没加载出来的素材选不到。
 */
export function AssetBrowser({
  filters,
  currentTool,
  headingLevel,
  onChange,
  onViewHistory,
  onSelectingChange,
}: {
  filters: AssetLibraryFilters;
  currentTool?: AssetTool | undefined;
  headingLevel: 2 | 3;
  onChange: (filters: AssetLibraryFilters) => void;
  onViewHistory?: (() => void) | undefined;
  onSelectingChange?: ((selecting: boolean) => void) | undefined;
}) {
  const location = useLocation();
  const session = useImageSession();
  const query = useAssetLibrary(filters);
  const selection = useAssetSelection(onSelectingChange);
  const [frame, width] = useWidth();
  const [preview, setPreview] = useState<number | null>(null);
  // 缩略图加载失败的素材不能下载：不出现在全选和批量下载里。
  const [unavailable, setUnavailable] = useState<ReadonlySet<string>>(() => new Set());
  const { failure, authenticationRequired } = useAssetStatus(session, query);
  const assets = query.data?.pages.flatMap((page) => page.data) ?? [];
  const downloadable = assets.filter((asset) => !unavailable.has(asset.id));
  const markUnavailable = (asset: ImageAsset) =>
    setUnavailable((current) => (current.has(asset.id) ? current : new Set(current).add(asset.id)));
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
          currentTool={currentTool}
          trailing={<AssetSelectionControls assets={downloadable} selection={selection} />}
          onChange={(next) => {
            selection.exit();
            onChange(next);
          }}
        />
        {width > 0 && (
          <AssetResults
            assets={assets}
            compact={width < compactWidth}
            headingLevel={headingLevel}
            filters={filters}
            selection={selection}
            unavailable={unavailable}
            onOpen={setPreview}
            onUnavailable={markUnavailable}
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

/** 选了时间范围后按天分组：每天一个标题加一段瀑布流。 */
function AssetDays({
  assets,
  headingLevel,
  masonry,
}: {
  assets: ImageAsset[];
  headingLevel: 2 | 3;
  masonry: (items: ImageAsset[]) => ReactNode;
}) {
  const locale = useLocale();
  const Day = headingLevel === 2 ? "h2" : "h3";
  return groupByDay(assets).map((group) => {
    const heading = dayHeading(group.first, locale);
    return (
      <section key={group.key} className="asset-day-group" aria-label={heading.label}>
        <Day className="asset-day">
          <b>{heading.label}</b>
          <span>{heading.detail}</span>
        </Day>
        {masonry(group.items)}
      </section>
    );
  });
}

/** 素材列表：全部时间时连续一整片瀑布流、不显示日期；选了时间范围才按天分组。滚到底自动加载下一页。 */
function AssetResults({
  assets,
  compact,
  headingLevel,
  filters,
  selection,
  unavailable,
  onOpen,
  onUnavailable,
  query,
  failure,
  retry,
}: {
  assets: ImageAsset[];
  compact: boolean;
  headingLevel: 2 | 3;
  filters: AssetLibraryFilters;
  selection: AssetSelection;
  unavailable: ReadonlySet<string>;
  onOpen: (index: number) => void;
  onUnavailable: (asset: ImageAsset) => void;
  query: AssetQuery;
  failure: Error | null;
  retry: () => void;
}) {
  const t = useMessages(assetsMessages);
  const locale = useLocale();
  const index = new Map(assets.map((asset, position) => [asset.id, position]));
  const masonry = (items: ImageAsset[]) => (
    <AssetMasonry
      assets={items}
      showUploadTag={filters.source === "all"}
      selection={selection}
      unavailable={unavailable}
      onOpen={(asset) => onOpen(index.get(asset.id) ?? 0)}
      onUnavailable={onUnavailable}
    />
  );
  if (failure)
    return (
      <AssetEmpty
        icon={IconPhotoX}
        title={t.unavailable}
        text={failure.message || t.checkNetwork}
        action={{
          label: t.reload,
          onPress: retry,
        }}
      />
    );
  if (query.isPending) return <Skeleton compact={compact} />;
  if (!assets.length) {
    const empty = emptyState(filters, locale);
    return <AssetEmpty icon={empty.icon} title={empty.title} />;
  }
  return (
    <>
      {filters.time === "all" ? (
        masonry(assets)
      ) : (
        <AssetDays assets={assets} headingLevel={headingLevel} masonry={masonry} />
      )}
      <InfiniteLoad
        hasMore={query.hasNextPage}
        isLoading={query.isFetchingNextPage}
        isError={query.isError}
        onLoadMore={() => query.fetchNextPage({ cancelRefetch: false })}
      />
    </>
  );
}

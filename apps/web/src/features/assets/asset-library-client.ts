import { toast } from "@heroui/react";
import {
  type AssetTool,
  assetFavoriteIdsResponseSchema,
  assetFavoriteResponseSchema,
  assetToolSchema,
  imageAssetsResponseSchema,
} from "@lycoboai/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { currentMessages } from "../../i18n/messages";
import { useErrorToast } from "../../lib/error-toast";
import { imageRequest, useImageSession } from "../generation/generation-client";
import { assetsMessages } from "./assets-messages";

/** 素材来源：全部、我上传的或 AI 生成；AI 生成还能按功能细分。 */
export type AssetSource = "all" | "uploads" | "generated";
/** 素材类型：一次只看图片或视频。 */
export type AssetMediaType = "image" | "video";
/** 时间范围：全部时间，或今天、最近 7／30／90 天（按本地日历日零点计算，含今天）。 */
export type AssetTimeRange = "all" | "today" | "7" | "30" | "90";
/** 我的素材的一组筛选，弹窗和素材库页面共用；都由接口在分页前执行。 */
export type AssetLibraryFilters = {
  source: AssetSource;
  /** 只在来源是 AI 生成时生效，"all" 表示不按功能筛选。 */
  tool: AssetTool | "all";
  type: AssetMediaType;
  favorite: boolean;
  /** 选了时间范围才按天分组；全部时间连续平铺。 */
  time: AssetTimeRange;
};

/** 素材库页面的默认视图：全部来源、全部时间的图片。 */
export const defaultAssetFilters: AssetLibraryFilters = {
  source: "all",
  tool: "all",
  type: "image",
  favorite: false,
  time: "all",
};
const sources = ["all", "uploads", "generated"] as const;
/** 时间筛选的选项，顺序就是菜单里的顺序。 */
export const assetTimeRanges = [
  "all",
  "today",
  "7",
  "30",
  "90",
] as const satisfies readonly AssetTimeRange[];
const pageSize = 30;

/** 从工作区打开时默认看当前功能生成的素材；视频创作默认看视频。 */
export function toolAssetFilters(tool: AssetTool | undefined): AssetLibraryFilters {
  if (!tool) return defaultAssetFilters;
  return {
    ...defaultAssetFilters,
    source: "generated",
    tool,
    type: tool === "video" ? "video" : "image",
  };
}

/**
 * 素材库把筛选写进地址栏，刷新和分享的链接回到同一视图。带功能的链接一律落在 AI 生成；
 * 改版前的“收藏素材”来源换成“仅看收藏”，已取消的模型筛选直接忽略。
 */
export function filtersFromSearch(search: URLSearchParams): AssetLibraryFilters {
  const tool = assetToolSchema.safeParse(search.get("tool"));
  const source = search.get("source");
  const favorite = search.get("favorite") === "1" || source === "favorites";
  const type = search.get("type") === "video" ? "video" : "image";
  const time = assetTimeRanges.find((entry) => entry === search.get("time")) ?? "all";
  if (tool.success) return { source: "generated", tool: tool.data, type, favorite, time };
  return {
    source: sources.find((entry) => entry === source) ?? "all",
    tool: "all",
    type,
    favorite,
    time,
  };
}

/** 只写入与默认视图不同的筛选，默认视图的地址保持干净。 */
export function filtersToSearch(filters: AssetLibraryFilters) {
  const search = new URLSearchParams();
  if (filters.source !== "all") search.set("source", filters.source);
  if (filters.source === "generated" && filters.tool !== "all") search.set("tool", filters.tool);
  if (filters.type === "video") search.set("type", "video");
  if (filters.time !== "all") search.set("time", filters.time);
  if (filters.favorite) search.set("favorite", "1");
  return search;
}

/** 时间范围的起点：本地日历日零点，“今天”从今天零点起，“最近 7 天”含今天共 7 天。 */
export function timeRangeStart(time: Exclude<AssetTimeRange, "all">, now = new Date()) {
  const since = new Date(now);
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (time === "today" ? 0 : Number(time) - 1));
  return since;
}

/** 把筛选换成接口参数：来源对应素材用途（kind），功能只在 AI 生成时传，时间换成起始时刻。 */
export function libraryQuery(filters: AssetLibraryFilters, now = new Date()) {
  const query = new URLSearchParams({
    limit: String(pageSize),
    includeVideo: "true",
    type: filters.type,
  });
  if (filters.source === "generated") query.set("kind", "output");
  if (filters.source === "uploads") query.set("kind", "reference");
  if (filters.source === "generated" && filters.tool !== "all") query.set("tool", filters.tool);
  if (filters.favorite) query.set("favorite", "true");
  if (filters.time !== "all") query.set("since", timeRangeStart(filters.time, now).toISOString());
  return query;
}

/** Filters run on the server before pagination; pages load as the list scrolls. */
export function useAssetLibrary(filters: AssetLibraryFilters) {
  const session = useImageSession();
  const query = libraryQuery(filters);
  return useInfiniteQuery({
    // Shares the image-assets prefix, so new-asset events refresh every open view.
    queryKey: ["image-assets", "library", query.toString()],
    enabled: session.isSuccess,
    initialPageParam: "",
    retry: false,
    queryFn: async ({ pageParam, signal }) => {
      const page = new URLSearchParams(query);
      if (pageParam) page.set("before", pageParam);
      return imageAssetsResponseSchema.parse(
        await (await imageRequest(`image-assets?${page}`, { signal })).json(),
      );
    },
    getNextPageParam: (last) => (last.data.length === pageSize ? last.data.at(-1)?.id : undefined),
  });
}

const favoritesKey = ["image-asset-favorites"] as const;
const toSet = (ids: string[]) => new Set(ids);

/** The member's favorites are one bounded id list shared by every star in the app. */
export function useFavoriteAssetIds() {
  const session = useImageSession();
  return useQuery({
    queryKey: favoritesKey,
    enabled: session.isSuccess,
    retry: false,
    staleTime: 60_000,
    queryFn: async ({ signal }) =>
      assetFavoriteIdsResponseSchema.parse(
        await (await imageRequest("image-asset-favorites", { signal })).json(),
      ).data,
    select: toSet,
  });
}

function useSetAssetFavorite() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, favorite }: { id: string; favorite: boolean }) =>
      assetFavoriteResponseSchema.parse(
        await (
          await imageRequest(`image-assets/${encodeURIComponent(id)}/favorite`, {
            method: favorite ? "PUT" : "DELETE",
          })
        ).json(),
      ).favorite,
    onMutate: async ({ id, favorite }) => {
      await client.cancelQueries({ queryKey: favoritesKey });
      const previous = client.getQueryData<string[]>(favoritesKey);
      client.setQueryData<string[]>(favoritesKey, (ids = []) =>
        favorite
          ? [id, ...ids.filter((entry) => entry !== id)]
          : ids.filter((entry) => entry !== id),
      );
      return { previous };
    },
    onSuccess: (favorite) => {
      const t = currentMessages(assetsMessages);
      toast.success(favorite ? t.favorited : t.unfavorited);
    },
    onError: (_error, _variables, context) => {
      client.setQueryData(favoritesKey, context?.previous);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: favoritesKey });
      // 只有按收藏筛选的列表成员会变；其他视图从收藏 id 读取星标状态。
      void client.invalidateQueries({
        queryKey: ["image-assets"],
        predicate: (query) => query.queryKey.some((part) => String(part).includes("favorite=true")),
      });
    },
  });
}

/** Star state for one asset; the server flag covers the moment before the id list loads. */
export function useAssetFavorite(assetId: string, initial = false) {
  const favorites = useFavoriteAssetIds();
  const save = useSetAssetFavorite();
  useErrorToast(save.error?.message);
  const favorite = favorites.data ? favorites.data.has(assetId) : initial;
  return {
    favorite,
    isPending: save.isPending,
    toggle: () => save.mutate({ id: assetId, favorite: !favorite }),
  };
}

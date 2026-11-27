import {
  type AssetTool,
  assetFavoriteIdsResponseSchema,
  assetFavoriteResponseSchema,
  type ImageTool,
  imageAssetsResponseSchema,
  imageToolSchema,
} from "@lycoboai/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { currentMessages } from "../../i18n/messages";
import { useErrorToast } from "../../lib/error-toast";
import { toast } from "../../lib/toast";
import { imageRequest, useImageSession } from "../generation/generation-client";
import { assetsMessages } from "./assets-messages";

/** 素材来源包括上传、AI 生成和通过 MCP 提交的生成。 */
export type AssetSource = "all" | "uploads" | "generated" | "mcp";
/** 时间范围：全部时间，或今天、最近 7／30／90 天（按本地日历日零点计算，含今天）。 */
export type AssetTimeRange = "all" | "today" | "7" | "30" | "90";
/** 我的素材的一组筛选，弹窗和素材库页面共用；都由接口在分页前执行。 */
export type AssetLibraryFilters = {
  source: AssetSource;
  /** 只在来源是 AI 生成时生效，"all" 表示不按功能筛选。 */
  tool: ImageTool | "all";
  favorite: boolean;
  /** 选了时间范围才按天分组；全部时间连续平铺。 */
  time: AssetTimeRange;
};

/** 素材库页面的默认视图：全部来源、全部时间的图片。 */
export const defaultAssetFilters: AssetLibraryFilters = {
  source: "all",
  tool: "all",
  favorite: false,
  time: "all",
};
const sources = ["all", "uploads", "generated", "mcp"] as const;
/** 时间筛选的选项，顺序就是菜单里的顺序。 */
export const assetTimeRanges = [
  "all",
  "today",
  "7",
  "30",
  "90",
] as const satisfies readonly AssetTimeRange[];
const pageSize = 30;

/** 从工作区打开时默认看当前图片工具的素材。 */
export function toolAssetFilters(tool: AssetTool | undefined): AssetLibraryFilters {
  if (!tool || tool === "video") return defaultAssetFilters;
  return {
    ...defaultAssetFilters,
    source: "generated",
    tool,
  };
}

/**
 * 素材库把筛选写进地址栏，刷新和分享的链接回到同一视图。显式的 MCP 来源优先于工具；
 * 兼容旧收藏链接，忽略已停用的类型和模型筛选。
 */
export function filtersFromSearch(search: URLSearchParams): AssetLibraryFilters {
  const tool = imageToolSchema.safeParse(search.get("tool"));
  const source = search.get("source");
  const favorite = search.get("favorite") === "1" || source === "favorites";
  const time = assetTimeRanges.find((entry) => entry === search.get("time")) ?? "all";
  if (source === "mcp") return { source, tool: "all", favorite, time };
  if (tool.success) return { source: "generated", tool: tool.data, favorite, time };
  return {
    source: sources.find((entry) => entry === source) ?? "all",
    tool: "all",
    favorite,
    time,
  };
}

/** 只写入与默认视图不同的筛选，默认视图的地址保持干净。 */
export function filtersToSearch(filters: AssetLibraryFilters) {
  const search = new URLSearchParams();
  if (filters.source !== "all") search.set("source", filters.source);
  if (filters.source === "generated" && filters.tool !== "all") search.set("tool", filters.tool);
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

/** 分页前固定只查图片，并应用来源、功能、时间和收藏筛选。 */
export function libraryQuery(filters: AssetLibraryFilters, now = new Date()) {
  const query = new URLSearchParams({
    limit: String(pageSize),
    type: "image",
  });
  if (filters.source === "generated") query.set("kind", "output");
  if (filters.source === "mcp") query.set("source", "mcp");
  if (filters.source === "uploads") query.set("kind", "reference");
  if (filters.source === "generated" && filters.tool !== "all") query.set("tool", filters.tool);
  if (filters.favorite) query.set("favorite", "true");
  if (filters.time !== "all") query.set("since", timeRangeStart(filters.time, now).toISOString());
  return query;
}

/** 服务端筛选后分页，滚动时加载下一页。 */
export function useAssetLibrary(filters: AssetLibraryFilters) {
  const session = useImageSession();
  const query = libraryQuery(filters);
  return useInfiniteQuery({
    // 素材更新时，用共享的查询键前缀刷新已打开的列表。
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

/** 读取成员收藏的素材 ID，供各入口的收藏状态共用。 */
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

/** 读取和切换单条素材的收藏状态，列表加载前使用素材自带的状态。 */
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

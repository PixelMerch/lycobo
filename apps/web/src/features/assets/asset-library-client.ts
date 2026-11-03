import {
  assetFavoriteIdsResponseSchema,
  assetFavoriteResponseSchema,
  type ImageTool,
  imageAssetsResponseSchema,
  imageToolSchema,
} from "@lycoboai/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useErrorToast } from "../../lib/error-toast";
import { imageRequest, useImageSession } from "../generation/generation-client";

export type AssetSource = "generated" | "uploads" | "favorites";
export type AssetMediaType = "all" | "image" | "video";
/** One filter set drives 素材库 and 我的素材; "all" means the filter is off. */
export type AssetLibraryFilters = {
  source: AssetSource;
  tool: ImageTool | "all";
  type: AssetMediaType;
  model: string;
};

export const defaultAssetFilters: AssetLibraryFilters = {
  source: "generated",
  tool: "all",
  type: "all",
  model: "all",
};
const sources = ["generated", "uploads", "favorites"] as const;
const mediaTypes = ["all", "image", "video"] as const;
const pageSize = 30;

/** Uploads have no producing tool or model, so those filters never apply to them. */
export const filtersApply = (filters: AssetLibraryFilters) => filters.source !== "uploads";

export function sameFilters(left: AssetLibraryFilters, right: AssetLibraryFilters) {
  return (
    left.source === right.source &&
    left.tool === right.tool &&
    left.type === right.type &&
    left.model === right.model
  );
}

/** 素材库 keeps filters in its URL so “在素材库中查看” and reloads land on the same view. */
export function filtersFromSearch(search: URLSearchParams): AssetLibraryFilters {
  const pick = <T extends string>(values: readonly T[], value: string | null, fallback: T) =>
    values.find((entry) => entry === value) ?? fallback;
  const tool = imageToolSchema.safeParse(search.get("tool"));
  const model = search.get("model");
  return {
    source: pick(sources, search.get("source"), "generated"),
    tool: tool.success ? tool.data : "all",
    type: pick(mediaTypes, search.get("type"), "all"),
    model: model && /^[a-z0-9][a-z0-9.-]{0,79}$/i.test(model) ? model : "all",
  };
}
export function filtersToSearch(filters: AssetLibraryFilters) {
  const search = new URLSearchParams();
  if (filters.source !== "generated") search.set("source", filters.source);
  if (filters.tool !== "all") search.set("tool", filters.tool);
  if (filters.type !== "all") search.set("type", filters.type);
  if (filters.model !== "all") search.set("model", filters.model);
  return search;
}

function libraryQuery(filters: AssetLibraryFilters) {
  const query = new URLSearchParams({ limit: String(pageSize) });
  if (filters.source === "generated") query.set("kind", "output");
  if (filters.source === "uploads") query.set("kind", "reference");
  if (filters.source === "favorites") query.set("favorite", "true");
  if (filters.type !== "all") query.set("type", filters.type);
  if (filtersApply(filters) && filters.tool !== "all") query.set("tool", filters.tool);
  if (filtersApply(filters) && filters.model !== "all") query.set("model", filters.model);
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
    onError: (_error, _variables, context) => {
      client.setQueryData(favoritesKey, context?.previous);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: favoritesKey });
      // Only lists filtered by favorite change membership; other views read stars from the ids.
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

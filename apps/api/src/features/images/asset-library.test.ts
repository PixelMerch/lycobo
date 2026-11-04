import {
  apiErrorSchema,
  assetFavoriteIdsResponseSchema,
  assetFavoriteLimit,
  assetFavoriteResponseSchema,
  imageAssetsResponseSchema,
  unwrapApiData,
} from "@lycoboai/contracts";
import { type ImageRepository, ImageRepositoryError } from "@lycoboai/db";
import type { ImageStore } from "@lycoboai/storage";
import { expect, it, vi } from "vitest";
import { createApp } from "../../app";

const unexpected = async (): Promise<never> => {
  throw new Error("Unexpected dependency call");
};
const principal = {
  userId: crypto.randomUUID(),
  organizationId: crypto.randomUUID(),
  role: "member" as const,
};
/** Only the methods a test provides exist; any other repository call fails the test. */
function fixture(methods: Partial<ImageRepository>) {
  const provided: Partial<ImageRepository> = { authenticate: async () => principal, ...methods };
  const repository = new Proxy(provided as ImageRepository, {
    get: (target, key) => (key in target ? target[key as keyof ImageRepository] : unexpected),
  });
  const store = new Proxy({} as ImageStore, { get: () => unexpected });
  const app = createApp(() => {}, {
    repository,
    store,
    enabled: true,
    unitCredits: 1,
    validate: () => {},
    resolutions: () => [],
  });
  return (path: string, method = "GET") =>
    app.request(`/api/v1${path}`, { method, headers: { Authorization: "Bearer fixture" } });
}
const asset = {
  public_id: "PCNLH66GX",
  id: crypto.randomUUID(),
  kind: "output",
  type: "image",
  width: 2048,
  height: 1152,
  bytes: 1024,
  created_at: "2026-11-03T07:52:00.000Z",
  task_public_id: "W12345678",
  model: "gpt-image-2.5",
  prompt: "fixture",
  tool: "textile",
  favorite: true,
};

it("applies tool, model and favorite filters in the repository, before pagination", async () => {
  const listAssets = vi
    .fn<ImageRepository["listAssets"]>()
    .mockResolvedValue([asset] as unknown as Awaited<ReturnType<ImageRepository["listAssets"]>>);
  const request = fixture({ listAssets });
  const response = await request(
    "/image-assets?limit=30&kind=output&type=image&tool=textile&model=gpt-image-2.5&favorite=true",
  );
  expect(response.status).toBe(200);
  const body = imageAssetsResponseSchema.parse(unwrapApiData(await response.json()));
  expect(body.data[0]).toMatchObject({ tool: "textile", favorite: true });
  expect(listAssets).toHaveBeenCalledWith(
    expect.objectContaining({ userId: principal.userId }),
    30,
    undefined,
    "output",
    "image",
    { tool: "textile", model: "gpt-image-2.5", favorite: true },
  );
  await request("/image-assets?limit=30");
  expect(listAssets).toHaveBeenLastCalledWith(
    expect.anything(),
    30,
    undefined,
    undefined,
    undefined,
    { tool: undefined, model: undefined, favorite: false },
  );
});

it.each([
  "tool=unknown",
  "model=..%2Fsecrets",
  `model=${"m".repeat(81)}`,
  "since=not-a-date",
  "since=2026-02-30T00:00:00Z",
  "favorite=1",
  "favorite=false",
])("rejects the invalid asset filter %s without reading assets", async (query) => {
  const request = fixture({ listAssets: unexpected });
  const response = await request(`/image-assets?${query}`);
  expect(response.status).toBe(400);
});

it("saves and removes favorites idempotently and hides assets outside the organization", async () => {
  const setAssetFavorite = vi
    .fn<ImageRepository["setAssetFavorite"]>()
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(null);
  const request = fixture({ setAssetFavorite });
  const id = crypto.randomUUID();
  const saved = await request(`/image-assets/${id}/favorite`, "PUT");
  expect(saved.status).toBe(200);
  expect(assetFavoriteResponseSchema.parse(unwrapApiData(await saved.json()))).toEqual({
    favorite: true,
  });
  expect(setAssetFavorite).toHaveBeenLastCalledWith(expect.anything(), id, true);
  const removed = await request(`/image-assets/${id}/favorite`, "DELETE");
  expect(assetFavoriteResponseSchema.parse(unwrapApiData(await removed.json()))).toEqual({
    favorite: false,
  });
  expect(setAssetFavorite).toHaveBeenLastCalledWith(expect.anything(), id, false);
  const missing = await request(`/image-assets/${crypto.randomUUID()}/favorite`, "PUT");
  expect(missing.status).toBe(404);
  expect(apiErrorSchema.parse(await missing.json()).message).toBe("素材不存在或已不可用");
  const malformed = await request("/image-assets/not-a-uuid/favorite", "PUT");
  expect(malformed.status).toBe(404);
  expect(setAssetFavorite).toHaveBeenCalledTimes(3);
});

it("explains the per-member favorite limit instead of a task conflict", async () => {
  const request = fixture({
    setAssetFavorite: async () => {
      throw new ImageRepositoryError("STATE_CONFLICT");
    },
  });
  const response = await request(`/image-assets/${crypto.randomUUID()}/favorite`, "PUT");
  expect(response.status).toBe(409);
  expect(apiErrorSchema.parse(await response.json()).message).toBe(
    `最多收藏 ${assetFavoriteLimit} 项，请先取消部分收藏`,
  );
});

it("returns only the signed-in member's favorite ids", async () => {
  const ids = [crypto.randomUUID(), crypto.randomUUID()];
  const favoriteAssetIds = vi.fn<ImageRepository["favoriteAssetIds"]>().mockResolvedValue(ids);
  const request = fixture({ favoriteAssetIds });
  const response = await request("/image-asset-favorites");
  expect(assetFavoriteIdsResponseSchema.parse(unwrapApiData(await response.json()))).toEqual({
    data: ids,
  });
  expect(favoriteAssetIds).toHaveBeenCalledWith(
    expect.objectContaining({ organizationId: principal.organizationId }),
  );
});

it("passes a validated creation-time boundary to scoped pagination", async () => {
  const listAssets = vi
    .fn<ImageRepository["listAssets"]>()
    .mockResolvedValue([] as unknown as Awaited<ReturnType<ImageRepository["listAssets"]>>);
  const request = fixture({ listAssets });
  const since = "2026-11-01T16:00:00.000Z";
  const before = crypto.randomUUID();
  const response = await request(`/image-assets?since=${since}&before=${before}`);
  expect(response.status).toBe(200);
  expect(listAssets).toHaveBeenCalledWith(
    expect.objectContaining({ organizationId: principal.organizationId }),
    30,
    before,
    undefined,
    undefined,
    expect.objectContaining({ since }),
  );
});

it("accepts video tool filtering before asset pagination", async () => {
  const listAssets = vi.fn<ImageRepository["listAssets"]>().mockResolvedValue([]);
  const response = await fixture({ listAssets })(
    "/image-assets?tool=video&type=video&includeVideo=true",
  );
  expect(response.status).toBe(200);
  expect(listAssets).toHaveBeenCalledWith(
    expect.anything(),
    30,
    undefined,
    undefined,
    "video",
    expect.objectContaining({ tool: "video", includeVideo: true }),
  );
});

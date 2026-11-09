import { assetFavoriteLimit, assetToolSchema, assetTypeSchema } from "@lycoboai/contracts";
import { ImageRepositoryError } from "@lycoboai/db";
import { maxImageBytes } from "@lycoboai/storage/core";
import type { Context, Hono } from "hono";
import { z } from "zod";
import { type Env, fail, type ImageApiDependencies, id } from "../route-context";
import type { ImageDeliveries } from "./delivery";
import { saveReferenceUpload } from "./reference-upload";

export function registerImageAssetLibrary(
  app: Hono<Env>,
  deps: ImageApiDependencies,
  delivery: ImageDeliveries | undefined,
) {
  app.get("/image-assets", async (c) => {
    const limit = z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(30)
      .safeParse(c.req.query("limit"));
    const before = id.optional().safeParse(c.req.query("before"));
    const kind = z.enum(["output", "reference"]).optional().safeParse(c.req.query("kind"));
    const type = assetTypeSchema.optional().safeParse(c.req.query("type"));
    const tool = assetToolSchema.optional().safeParse(c.req.query("tool"));
    // Public model ids only, e.g. gpt-image-2.5; the repository maps provider variants onto them.
    const model = z
      .string()
      .regex(/^[a-z0-9][a-z0-9.-]{0,79}$/i)
      .optional()
      .safeParse(c.req.query("model"));
    const since = z.string().datetime({ offset: true }).optional().safeParse(c.req.query("since"));
    const favorite = z.literal("true").optional().safeParse(c.req.query("favorite"));
    if (
      !limit.success ||
      !before.success ||
      !kind.success ||
      !type.success ||
      !tool.success ||
      !model.success ||
      !favorite.success ||
      !since.success
    )
      return fail(c, "VALIDATION_ERROR", "筛选或分页参数无效", 400);
    const includeVideo = z.literal("true").optional().safeParse(c.req.query("includeVideo"));
    if (!includeVideo.success) return fail(c, "VALIDATION_ERROR", "素材类型参数无效", 400);
    const scope = c.get("principal");
    const assets = await deps.repository.listAssets(
      scope,
      limit.data,
      before.data,
      kind.data,
      type.data,
      {
        tool: tool.data,
        model: model.data,
        favorite: favorite.data === "true",
        ...(since.data ? { since: since.data } : {}),
        ...(includeVideo.data ? { includeVideo: true } : {}),
      },
    );
    return c.json({ data: delivery ? await delivery.assets(scope, assets) : assets });
  });
  // The signed-in member's favorite ids, bounded by the per-member favorite limit.
  app.get("/image-asset-favorites", async (c) =>
    c.json({ data: await deps.repository.favoriteAssetIds(c.get("principal")) }),
  );
  const saveFavorite = async (c: Context<Env>, favorite: boolean) => {
    const parsed = id.safeParse(c.req.param("id"));
    if (!parsed.success) return fail(c, "NOT_FOUND", "素材不存在或已不可用", 404);
    let saved: boolean | null;
    try {
      saved = await deps.repository.setAssetFavorite(c.get("principal"), parsed.data, favorite);
    } catch (error) {
      if (error instanceof ImageRepositoryError && error.code === "STATE_CONFLICT")
        return fail(
          c,
          "STATE_CONFLICT",
          `最多收藏 ${assetFavoriteLimit} 项，请先取消部分收藏`,
          409,
        );
      throw error;
    }
    return saved === null
      ? fail(c, "NOT_FOUND", "素材不存在或已不可用", 404)
      : c.json({ favorite: saved });
  };
  app.put("/image-assets/:id/favorite", (c) => saveFavorite(c, true));
  app.delete("/image-assets/:id/favorite", (c) => saveFavorite(c, false));
}

async function redirectAssetContent(
  c: Context<Env>,
  repository: ImageApiDependencies["repository"],
  signAsset: NonNullable<ImageApiDependencies["signAsset"]>,
  assetId: string,
  download: boolean,
  thumbnail: boolean,
) {
  const [location] = await repository.assetLocations(c.get("principal"), [assetId]);
  if (!location) return fail(c, "NOT_FOUND", "素材不存在", 404);
  const urls = await signAsset(location.objectKey);
  if (download) return c.redirect(urls.download_url, 302);
  return c.redirect(thumbnail ? urls.thumbnail_url : urls.url, 302);
}

export function registerImageAssetDelivery(
  app: Hono<Env>,
  deps: ImageApiDependencies,
  delivery: ImageDeliveries | undefined,
) {
  app.post("/image-assets", async (c) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(c.req.header("Content-Type") ?? ""))
      return fail(c, "INVALID_IMAGE", "仅支持 PNG、JPEG、WebP", 400);
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    if (bytes.length > maxImageBytes) return fail(c, "PAYLOAD_TOO_LARGE", "图片超过 10MB", 413);
    if (deps.uploadsEnabled === false)
      return fail(c, "GENERATION_NOT_CONFIGURED", "图片上传暂不可用", 503);
    if (deps.uploads) {
      const uploadId = await deps.uploads.enqueue(c.get("principal"), bytes);
      return c.json({ uploadId }, 202);
    }
    return saveReferenceUpload(c, deps, bytes);
  });
  app.get("/image-uploads/:id", async (c) => {
    const parsed = id.safeParse(c.req.param("id"));
    if (!parsed.success || !deps.uploads) return fail(c, "NOT_FOUND", "上传记录不存在", 404);
    const result = await deps.uploads.status(c.get("principal"), parsed.data);
    if (!result) return fail(c, "NOT_FOUND", "上传记录不存在或已过期", 404);
    if (!result.image) return c.json({ status: result.status });
    const delivery = deps.signAsset ? await deps.signAsset(result.image.objectKey) : undefined;
    return c.json({
      status: "succeeded",
      asset: { id: result.image.id, ...(delivery ? { delivery } : {}) },
    });
  });
  app.post("/image-assets/deliveries", async (c) => {
    const input = z
      .object({ ids: z.array(id).min(1).max(100) })
      .safeParse(await c.req.json().catch(() => null));
    if (!input.success) return fail(c, "VALIDATION_ERROR", "图片列表无效", 400);
    if (!delivery) return fail(c, "GENERATION_NOT_CONFIGURED", "图片访问尚未配置", 503);
    const assets = await delivery.assets(
      c.get("principal"),
      [...new Set(input.data.ids)].map((id) => ({ id })),
    );
    // Never issue capabilities for missing, expired, or other-workspace objects.
    return c.json({ data: assets.filter((asset) => asset.delivery) });
  });
  app.get("/image-assets/:id/delivery", async (c) => {
    const parsed = id.safeParse(c.req.param("id"));
    if (!parsed.success) return fail(c, "NOT_FOUND", "图片不存在", 404);
    const [asset] = await deps.repository.assetLocations(c.get("principal"), [parsed.data]);
    if (!asset) return fail(c, "NOT_FOUND", "图片不存在", 404);
    if (!deps.signAsset) return fail(c, "GENERATION_NOT_CONFIGURED", "图片访问尚未配置", 503);
    return c.json({ id: asset.id, delivery: await deps.signAsset(asset.objectKey) });
  });
  app.get("/image-assets/:id/content", async (c) => {
    const parsed = id.safeParse(c.req.param("id"));
    if (!parsed.success) return fail(c, "NOT_FOUND", "图片不存在", 404);
    const download = c.req.query("download") === "1";
    const thumbnail = !download && c.req.query("thumbnail") === "1";
    if (deps.signAsset)
      return redirectAssetContent(
        c,
        deps.repository,
        deps.signAsset,
        parsed.data,
        download,
        thumbnail,
      );
    const asset = await deps.repository.asset(c.get("principal"), parsed.data);
    if (!asset) return fail(c, "NOT_FOUND", "图片不存在", 404);
    const bytes = thumbnail ? await deps.store.thumbnail(asset) : await deps.store.read(asset);
    c.header("Content-Type", "image/png");
    c.header(
      "Content-Disposition",
      `${download ? "attachment" : "inline"}; filename="${asset.id}.png"`,
    );
    return c.body(new Uint8Array(bytes));
  });
}

import {
  imageGenerationInputSchema,
  imageModelCatalog,
  type StoredImage,
} from "@lycoboai/contracts";
import { type ImagePrincipal, type ImageRepository, ImageRepositoryError } from "@lycoboai/db";
import { type ImageStore, ImageValidationError, maxImageBytes } from "@lycoboai/storage";
import { type Context, Hono } from "hono";
import { z } from "zod";

export type ImageApiDependencies = {
  repository: ImageRepository;
  store: ImageStore;
  enabled: boolean;
  unitCredits: number;
  // Capability policy is shared with the Worker and injected at startup.
  validate: (input: z.infer<typeof imageGenerationInputSchema>) => void;
  resolutions: (model: z.infer<typeof imageGenerationInputSchema>["model"]) => string[];
};
type Env = { Variables: { principal: ImagePrincipal; requestId: string } };
const id = z.uuid();
export function imageRoutes(deps: ImageApiDependencies) {
  const app = new Hono<Env>();
  const fail = (
    c: Context<Env>,
    code: string,
    message: string,
    status: 400 | 401 | 403 | 404 | 409 | 413 | 503,
  ) => c.json({ error: { code, message, requestId: c.get("requestId") } }, status);
  app.use("*", async (c, next) => {
    const auth = c.req.header("Authorization");
    const principal = auth?.startsWith("Bearer ")
      ? await deps.repository.authenticate(auth.slice(7))
      : null;
    if (!principal) return fail(c, "UNAUTHORIZED", "请先验证身份", 401);
    c.set("principal", principal);
    await next();
  });
  app.onError((error, c) => {
    if (error instanceof ImageRepositoryError) {
      const status =
        error.code === "FORBIDDEN"
          ? 403
          : error.code === "NOT_FOUND"
            ? 404
            : error.code === "REFERENCE_NOT_FOUND"
              ? 400
              : 409;
      return fail(c, error.code, "请求未执行，请检查权限、余额或任务状态", status);
    }
    if (error instanceof SyntaxError) return fail(c, "VALIDATION_ERROR", "请求格式不正确", 400);
    throw error;
  });
  app.get("/image-models", (c) =>
    c.json({
      enabled: deps.enabled,
      unitCredits: deps.unitCredits,
      models: imageModelCatalog.map((m) => ({ ...m, enabledResolutions: deps.resolutions(m.id) })),
    }),
  );
  app.post("/image-tasks", async (c) => {
    if (!deps.enabled) return fail(c, "GENERATION_NOT_CONFIGURED", "生图服务尚未启用", 503);
    const input = imageGenerationInputSchema.safeParse(await c.req.json());
    const key = id.safeParse(c.req.header("Idempotency-Key"));
    if (!input.success || !key.success)
      return fail(c, "VALIDATION_ERROR", "请检查参数和 Idempotency-Key", 400);
    try {
      deps.validate(input.data);
    } catch {
      return fail(c, "MODEL_CAPABILITY_UNVERIFIED", "模型分辨率或参考编辑能力尚未验证", 400);
    }
    const result = await deps.repository.create(
      c.get("principal"),
      input.data,
      key.data,
      deps.unitCredits,
    );
    return c.json(result, result.replayed ? 200 : 202);
  });
  app.get("/image-tasks", async (c) => {
    const limit = z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .safeParse(c.req.query("limit"));
    const before = id.optional().safeParse(c.req.query("before"));
    if (!limit.success || !before.success) return fail(c, "VALIDATION_ERROR", "分页参数无效", 400);
    return c.json({
      data: await deps.repository.list(c.get("principal"), limit.data, before.data),
    });
  });
  app.get("/image-tasks/:id", async (c) => {
    const parsed = id.safeParse(c.req.param("id"));
    if (!parsed.success) return fail(c, "NOT_FOUND", "任务不存在", 404);
    const job = await deps.repository.get(c.get("principal"), parsed.data);
    return job ? c.json(job) : fail(c, "NOT_FOUND", "任务不存在", 404);
  });
  app.post("/image-assets", async (c) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(c.req.header("Content-Type") ?? ""))
      return fail(c, "INVALID_IMAGE", "仅支持 PNG、JPEG、WebP", 400);
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    if (bytes.length > maxImageBytes) return fail(c, "PAYLOAD_TOO_LARGE", "图片超过 10MB", 413);
    let asset: StoredImage;
    try {
      asset = await deps.store.put(c.get("principal"), bytes);
    } catch (error) {
      if (error instanceof ImageValidationError)
        return fail(c, "INVALID_IMAGE", "图片格式或尺寸无效", 400);
      throw error;
    }
    try {
      await deps.repository.addReference(c.get("principal"), asset);
    } catch (error) {
      await deps.store.remove(asset).catch(() => {});
      throw error;
    }
    return c.json(
      {
        id: asset.id,
        width: asset.width,
        height: asset.height,
        bytes: asset.bytes,
        mimeType: asset.mimeType,
      },
      201,
    );
  });
  app.get("/image-assets/:id/content", async (c) => {
    const parsed = id.safeParse(c.req.param("id"));
    if (!parsed.success) return fail(c, "NOT_FOUND", "图片不存在", 404);
    const asset = await deps.repository.asset(c.get("principal"), parsed.data);
    if (!asset) return fail(c, "NOT_FOUND", "图片不存在", 404);
    const bytes = await deps.store.read(asset);
    c.header("Content-Type", "image/png");
    c.header("Content-Disposition", `inline; filename="${asset.id}.png"`);
    return c.body(new Uint8Array(bytes));
  });
  app.post("/image-tasks/:jobId/items/:itemId/reconcile-failure", async (c) => {
    if (c.get("principal").role !== "admin") return fail(c, "FORBIDDEN", "需要组织管理员核对", 403);
    const jobId = id.safeParse(c.req.param("jobId")),
      itemId = id.safeParse(c.req.param("itemId"));
    const body = z
      .strictObject({
        verifiedFailed: z.literal(true),
        evidence: z.string().trim().min(10).max(1000),
      })
      .safeParse(await c.req.json());
    if (!jobId.success || !itemId.success || !body.success)
      return fail(c, "VALIDATION_ERROR", "请提供服务商核对依据", 400);
    await deps.repository.reconcile(
      c.get("principal"),
      jobId.data,
      itemId.data,
      body.data.evidence,
    );
    return c.json({ status: "failed", creditsReleased: true });
  });
  return app;
}

import {
  assetTypeSchema,
  imageGenerationInputSchema,
  imageModelCatalog,
  imageTaskRetrySchema,
  imageUnitCredits,
  type StoredImage,
} from "@lycoboai/contracts";
import {
  type ImageEventFeed,
  type ImagePrincipal,
  type ImageRepository,
  ImageRepositoryError,
  WalletError,
} from "@lycoboai/db";
import { normalizeTextileGeneration } from "@lycoboai/generation";
import { type ImageStore, ImageValidationError, maxImageBytes } from "@lycoboai/storage/core";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { enterprisePrincipal } from "../auth/routes";
import type { EnterpriseAuth } from "../auth/service";
import { type DeliverySigner, imageDeliveries } from "./delivery";
import { imageEventStream } from "./events";
import {
  setWorkbenchCookie,
  trustedWorkbenchRequest,
  type WorkbenchSession,
  workbenchPrincipal,
} from "./session";

export type ImageApiDependencies = {
  repository: ImageRepository;
  modelSecret?: string | undefined;
  events?: ImageEventFeed | undefined;
  signAsset?: DeliverySigner | undefined;
  auth?: EnterpriseAuth | undefined;
  store: ImageStore;
  enabled: boolean;
  unitCredits: number;
  editsEnabled?: boolean;
  session?: WorkbenchSession | undefined;
  // Capability policy is shared with the Worker and injected at startup.
  validate: (input: z.infer<typeof imageGenerationInputSchema>) => void;
  resolutions: (model: z.infer<typeof imageGenerationInputSchema>["model"]) => string[];
};
type Env = { Variables: { principal: ImagePrincipal; requestId: string } };
const id = z.uuid();
export function imageRoutes(deps: ImageApiDependencies) {
  const app = new Hono<Env>();
  const delivery = deps.signAsset ? imageDeliveries(deps.repository, deps.signAsset) : undefined;
  const fail = (
    c: Context<Env>,
    code: string,
    message: string,
    status: 400 | 401 | 403 | 404 | 409 | 413 | 503,
  ) => c.json({ error: { code, message, requestId: c.get("requestId") } }, status);
  const resolvePrincipal = async (c: Context) => {
    const bearer = c.req.header("Authorization");
    // Keep existing service API keys compatible; browser sessions never fall back to local identity.
    if (deps.auth && bearer && /^Bearer [\w-]{43}$/.test(bearer))
      return deps.repository.authenticate(bearer.slice(7));
    return deps.auth
      ? (await enterprisePrincipal(c, deps.auth))?.user
      : workbenchPrincipal(c, deps.repository, deps.session);
  };
  app.post("/image-session", async (c) => {
    if (deps.auth) {
      const principal = await resolvePrincipal(c);
      return principal
        ? c.json({ userId: principal.userId, organizationId: principal.organizationId })
        : fail(c, "UNAUTHORIZED", "请先登录", 401);
    }
    if (!deps.session || !trustedWorkbenchRequest(c, deps.session))
      return fail(c, "UNAUTHORIZED", "请先登录工作台", 401);
    const principal = await deps.repository.authenticate(deps.session.token);
    if (!principal) return fail(c, "UNAUTHORIZED", "工作台身份已过期，请重新配置", 401);
    setWorkbenchCookie(c, deps.session);
    return c.json({ userId: principal.userId, organizationId: principal.organizationId });
  });
  // Display-only metadata is public; authenticated task and capability routes stay below.
  app.get("/image-model-logos", async (c) => c.json(await deps.repository.models.logos()));
  app.use("*", async (c, next) => {
    const principal = await resolvePrincipal(c);
    if (!principal) return fail(c, "UNAUTHORIZED", "请先验证身份", 401);
    c.set("principal", principal);
    await next();
  });
  app.onError((error, c) => {
    if (error instanceof ImageRepositoryError || error instanceof WalletError) {
      const status =
        error.code === "FORBIDDEN"
          ? 403
          : error.code === "NOT_FOUND"
            ? 404
            : error.code === "REFERENCE_NOT_FOUND" || error.code === "MODEL_CAPABILITY_UNVERIFIED"
              ? 400
              : 409;
      return fail(
        c,
        error.code,
        error.code === "MODEL_CAPABILITY_UNVERIFIED"
          ? "当前模型渠道未启用或不支持所选参数，请刷新模型配置"
          : error.code === "INSUFFICIENT_CREDITS"
            ? "企业金币余额不足，每张图片需要 20 币"
            : error.code === "STATE_CONFLICT"
              ? "任务正在生成或状态已更新，请稍后重试"
              : error.code === "FORBIDDEN"
                ? "没有权限操作此任务"
                : error.code === "NOT_FOUND"
                  ? "任务不存在或已不可用"
                  : "请求未执行，请刷新后重试",
        status,
      );
    }
    if (error instanceof SyntaxError) return fail(c, "VALIDATION_ERROR", "请求格式不正确", 400);
    throw error;
  });
  const connections = new Map<string, number>();
  app.get("/image-events", async (c) => {
    const feed = deps.events;
    if (!feed) return fail(c, "GENERATION_NOT_CONFIGURED", "实时通知暂不可用", 503);
    const scope = c.get("principal");
    const connectionKey = `${scope.organizationId}:${scope.userId}`;
    if ((connections.get(connectionKey) ?? 0) >= 8)
      return fail(c, "FORBIDDEN", "实时连接过多，请关闭多余页面", 403);
    connections.set(connectionKey, (connections.get(connectionKey) ?? 0) + 1);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      const count = (connections.get(connectionKey) ?? 1) - 1;
      if (count > 0) connections.set(connectionKey, count);
      else connections.delete(connectionKey);
    };
    try {
      const response = await imageEventStream(c, feed, scope, async () => {
        const current = await resolvePrincipal(c);
        return (
          !!current &&
          current.userId === scope.userId &&
          current.organizationId === scope.organizationId
        );
      });
      if (!response.body || !response.headers.get("Content-Type")?.includes("text/event-stream")) {
        release();
        return response;
      }
      const reader = response.body.getReader();
      return new Response(
        new ReadableStream({
          async pull(controller) {
            try {
              const next = await reader.read();
              if (next.done) {
                release();
                controller.close();
              } else controller.enqueue(next.value);
            } catch (error) {
              release();
              controller.error(error);
            }
          },
          async cancel() {
            release();
            await reader.cancel();
          },
        }),
        { status: response.status, headers: response.headers },
      );
    } catch {
      release();
      return fail(c, "GENERATION_NOT_CONFIGURED", "实时通知暂不可用", 503);
    }
  });
  app.get("/image-models", async (c) => {
    const tools = await deps.repository.models.capabilities();
    return c.json({
      enabled: deps.enabled,
      eventsEnabled: !!deps.events,
      editsEnabled:
        deps.editsEnabled ||
        Object.values(tools).some((models) =>
          models.some((m) => m.managed && m.editsEnabled && m.enabledResolutions.length > 0),
        ),
      unitCredits: imageUnitCredits,
      tools,
      models: imageModelCatalog.map((m) => ({
        ...m,
        enabledResolutions:
          tools.create?.find((option) => option.id === m.id && option.managed)
            ?.enabledResolutions ?? deps.resolutions(m.id),
      })),
    });
  });
  app.get("/wallet", async (c) =>
    c.json({
      ...(await deps.repository.wallet(c.get("principal"))),
      unitCredits: imageUnitCredits,
    }),
  );
  app.get("/wallet/entries", async (c) => {
    const parsed = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(20),
        before: z
          .string()
          .regex(/^[1-9][0-9]{0,18}$/)
          .refine((value) => BigInt(value) <= 9223372036854775807n)
          .optional(),
      })
      .safeParse(c.req.query());
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "分页参数无效", 400);
    return c.json({
      data: await deps.repository.walletEntries(
        c.get("principal"),
        parsed.data.limit,
        parsed.data.before,
      ),
    });
  });
  app.get("/wallet/recharges", async (c) => {
    const parsed = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(20),
        before: z.uuid().optional(),
      })
      .safeParse(c.req.query());
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "分页参数无效", 400);
    return c.json({
      data: await deps.repository.rechargeOrders(
        c.get("principal"),
        parsed.data.limit,
        parsed.data.before,
      ),
    });
  });
  app.post("/image-tasks", async (c) => {
    if (!deps.enabled) return fail(c, "GENERATION_NOT_CONFIGURED", "生图服务尚未启用", 503);
    const input = imageGenerationInputSchema.safeParse(await c.req.json());
    const key = id.safeParse(c.req.header("Idempotency-Key"));
    if (!input.success || !key.success)
      return fail(c, "VALIDATION_ERROR", "请检查参数和 Idempotency-Key", 400);
    const normalized = normalizeTextileGeneration(input.data);
    try {
      if (!(await deps.repository.models.hasRoute(normalized))) deps.validate(normalized);
    } catch {
      return fail(c, "MODEL_CAPABILITY_UNVERIFIED", "模型分辨率或参考编辑能力尚未验证", 400);
    }
    const result = await deps.repository.create(
      c.get("principal"),
      normalized,
      key.data,
      imageUnitCredits,
    );
    return c.json(result, result.replayed ? 200 : 202);
  });
  app.post("/image-tasks/:jobId/retry", async (c) => {
    if (!deps.enabled) return fail(c, "GENERATION_NOT_CONFIGURED", "生图服务尚未启用", 503);
    const jobId = id.safeParse(c.req.param("jobId"));
    const key = id.safeParse(c.req.header("Idempotency-Key"));
    if (!jobId.success || !key.success) return fail(c, "VALIDATION_ERROR", "重试参数无效", 400);
    const body = await c.req.text();
    const target = imageTaskRetrySchema.safeParse(body ? JSON.parse(body) : {});
    if (!target.success) return fail(c, "VALIDATION_ERROR", "重试图片参数无效", 400);
    const scope = c.get("principal");
    const job = await deps.repository.get(scope, jobId.data);
    if (!job) return fail(c, "NOT_FOUND", "任务不存在", 404);
    try {
      const input = imageGenerationInputSchema.parse(job.input);
      if (!(await deps.repository.models.hasRoute(input))) deps.validate(input);
    } catch {
      return fail(c, "MODEL_CAPABILITY_UNVERIFIED", "模型能力尚未验证", 400);
    }
    const result = await deps.repository.retry(scope, jobId.data, key.data, target.data.itemId);
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
    const tool = z.enum(["create", "textile"]).optional().safeParse(c.req.query("tool"));
    if (!limit.success || !before.success || !tool.success)
      return fail(c, "VALIDATION_ERROR", "分页参数无效", 400);
    const scope = c.get("principal");
    const jobs = await deps.repository.list(scope, limit.data, before.data, tool.data);
    return c.json({ data: delivery ? await delivery.jobs(scope, jobs) : jobs });
  });
  app.delete("/image-tasks/:id", async (c) => {
    const parsed = id.safeParse(c.req.param("id"));
    if (!parsed.success) return fail(c, "NOT_FOUND", "任务不存在", 404);
    await deps.repository.archive(c.get("principal"), parsed.data);
    return c.json({ id: parsed.data });
  });
  app.get("/image-tasks/:id", async (c) => {
    const parsed = id.safeParse(c.req.param("id"));
    if (!parsed.success) return fail(c, "NOT_FOUND", "任务不存在", 404);
    const job = await deps.repository.get(c.get("principal"), parsed.data);
    return job
      ? c.json(delivery ? (await delivery.jobs(c.get("principal"), [job]))[0] : job)
      : fail(c, "NOT_FOUND", "任务不存在", 404);
  });
  app.get("/image-assets/:id/latest-edit", async (c) => {
    const parsed = id.safeParse(c.req.param("id"));
    if (!parsed.success) return fail(c, "NOT_FOUND", "图片不存在", 404);
    const scope = c.get("principal");
    const job = await deps.repository.latestEdit(scope, parsed.data);
    return c.json({ job: job && delivery ? (await delivery.jobs(scope, [job]))[0] : job });
  });
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
    if (!limit.success || !before.success || !kind.success || !type.success)
      return fail(c, "VALIDATION_ERROR", "筛选或分页参数无效", 400);
    const scope = c.get("principal");
    const assets = await deps.repository.listAssets(
      scope,
      limit.data,
      before.data,
      kind.data,
      type.data,
    );
    return c.json({ data: delivery ? await delivery.assets(scope, assets) : assets });
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
        ...(deps.signAsset ? { delivery: await deps.signAsset(asset.objectKey) } : {}),
      },
      201,
    );
  });
  app.get("/image-assets/:id/delivery", async (c) => {
    const parsed = id.safeParse(c.req.param("id"));
    if (!parsed.success) return fail(c, "NOT_FOUND", "图片不存在", 404);
    const asset = await deps.repository.asset(c.get("principal"), parsed.data);
    if (!asset) return fail(c, "NOT_FOUND", "图片不存在", 404);
    if (!deps.signAsset) return fail(c, "GENERATION_NOT_CONFIGURED", "图片访问尚未配置", 503);
    return c.json({ id: asset.id, delivery: await deps.signAsset(asset.objectKey) });
  });
  app.get("/image-assets/:id/content", async (c) => {
    const parsed = id.safeParse(c.req.param("id"));
    if (!parsed.success) return fail(c, "NOT_FOUND", "图片不存在", 404);
    const asset = await deps.repository.asset(c.get("principal"), parsed.data);
    if (!asset) return fail(c, "NOT_FOUND", "图片不存在", 404);
    if (deps.signAsset) {
      const urls = await deps.signAsset(asset.objectKey);
      return c.redirect(c.req.query("thumbnail") === "1" ? urls.thumbnail_url : urls.url, 302);
    }
    const bytes =
      c.req.query("thumbnail") === "1"
        ? await deps.store.thumbnail(asset)
        : await deps.store.read(asset);
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

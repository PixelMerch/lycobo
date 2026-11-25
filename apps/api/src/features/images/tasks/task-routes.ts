import {
  type ImageGenerationInput,
  imageGenerationInputSchema,
  imageItemStatusSchema,
  imageTaskRetrySchema,
  imageTaskSubmissionSchema,
  imageToolSchema,
  imageUnitCredits,
} from "@lycoboai/contracts";
import { normalizeTextileGeneration, textileItemInput } from "@lycoboai/generation";
import type { Context, Hono } from "hono";
import { z } from "zod";
import type { ImageDeliveries } from "../assets/delivery";
import { type Env, fail, type ImageApiDependencies, id } from "../route-context";
import { providerRetryService } from "./provider-retry-service";

async function supportsTaskModel(
  deps: ImageApiDependencies,
  input: Parameters<ImageApiDependencies["validate"]>[0],
) {
  try {
    if (await deps.repository.models.hasRoute(input)) return true;
    if (deps.managedModelsOnly) return false;
    deps.validate(input);
    return true;
  } catch {
    return false;
  }
}

async function taskSubmissionResponse<T extends { replayed: boolean }>(
  c: Context<Env>,
  wake: ImageApiDependencies["wake"],
  result: T,
) {
  if (!result.replayed) await wake?.();
  return c.json(result, result.replayed ? 200 : 202);
}

function normalizeSubmittedTask(input: ImageGenerationInput): ImageGenerationInput {
  if (input.replica)
    return { ...input, model: "gpt-image-2.6", count: input.referenceAssetIds.length - 1 };
  if (!input.variation) return normalizeTextileGeneration(input);
  // 旧客户端仍可用原始型号确认已接收的请求，实际渠道由任务类型决定。
  const model = input.model === "gpt-image-2.6" ? input.model : "gpt-image-2.5";
  return { ...input, model, quality: "medium" };
}

async function prepareReferenceUploads(
  deps: ImageApiDependencies,
  scope: Env["Variables"]["principal"],
  referenceIds: readonly string[],
) {
  const uploads = deps.uploads;
  if (!uploads) return [];
  // 以服务端保存的上传意图为准，允许仍在排队处理的参考图。
  const states = await Promise.all(referenceIds.map((id) => uploads.status(scope, id)));
  return referenceIds.filter((_, index) => states[index]?.status === "pending");
}

async function screenImageTask(
  c: Context<Env>,
  moderate: ImageApiDependencies["moderate"],
  input: ImageGenerationInput,
  positions: readonly number[],
) {
  if (!moderate || positions.length === 0) return;
  // 使用消费者实际发送的文案，不信任客户端另传的展示用 userPrompt。
  const prompts = positions.map((position) => textileItemInput(input, position).prompt);
  const instructions = input.localEdit?.regions.map((region) => region.prompt) ?? [];
  await moderate([...prompts, ...instructions], c.get("requestId"), c.req.raw.signal);
}

const retryItemsSchema = z.array(
  z.object({ id, position: z.number().int().nonnegative(), status: imageItemStatusSchema }),
);
const retryRequestSchema = z.object({ jobId: id, key: id, target: imageTaskRetrySchema });

async function screenImageRetry(
  c: Context<Env>,
  moderate: ImageApiDependencies["moderate"],
  input: ImageGenerationInput,
  items: unknown,
  itemId?: string,
) {
  if (!moderate) return undefined;
  const positions = retryItemsSchema
    .parse(items)
    .filter(
      (item) =>
        (!itemId || item.id === itemId) &&
        (item.status === "failed" || item.status === "needs_reconciliation"),
    )
    .map((item) => item.position);
  await screenImageTask(c, moderate, input, positions);
  return positions;
}

/** 校验任务与服务端上传意图，再原子接收付费生成。 */
export function registerImageTaskSubmission(app: Hono<Env>, deps: ImageApiDependencies) {
  app.post("/image-tasks", async (c) => {
    if (!deps.enabled) return fail(c, "GENERATION_NOT_CONFIGURED", "生图服务尚未启用", 503);
    const input = imageTaskSubmissionSchema.safeParse(await c.req.json());
    const key = id.safeParse(c.req.header("Idempotency-Key"));
    if (!input.success || !key.success)
      return fail(c, "VALIDATION_ERROR", "请检查参数和 Idempotency-Key", 400);
    const { userPrompt, ...modelInput } = input.data;
    const normalized = normalizeSubmittedTask(modelInput);
    const scope = c.get("principal");
    const positions = Array.from({ length: normalized.count }, (_, index) => index);
    const [supported, acceptedUploads] = await Promise.all([
      supportsTaskModel(deps, normalized),
      prepareReferenceUploads(deps, scope, normalized.referenceAssetIds),
      screenImageTask(c, deps.moderate, normalized, positions),
    ]);
    if (!supported)
      return fail(c, "MODEL_CAPABILITY_UNVERIFIED", "当前模型暂不可用，请选择其他模型", 400);
    const result = await deps.repository.create(
      scope,
      { ...normalized, userPrompt },
      key.data,
      imageUnitCredits,
      deps.managedModelsOnly,
      acceptedUploads,
    );
    return taskSubmissionResponse(c, deps.wake, result);
  });
  app.post("/image-tasks/:jobId/retry", async (c) => {
    if (!deps.enabled) return fail(c, "GENERATION_NOT_CONFIGURED", "生图服务尚未启用", 503);
    const body = await c.req.text();
    const request = retryRequestSchema.safeParse({
      jobId: c.req.param("jobId"),
      key: c.req.header("Idempotency-Key"),
      target: body ? JSON.parse(body) : {},
    });
    if (!request.success) return fail(c, "VALIDATION_ERROR", "重试图片参数无效", 400);
    const { jobId, key, target } = request.data;
    const scope = c.get("principal");
    const job = await deps.repository.get(scope, jobId);
    if (!job) return fail(c, "NOT_FOUND", "任务不存在", 404);
    if (await providerRetryService(deps)(scope, jobId, target.itemId)) {
      await deps.wake?.();
      return c.json({ id: jobId, replayed: false }, 202);
    }
    const storedInput = imageGenerationInputSchema.safeParse(job.input);
    if (!storedInput.success || !(await supportsTaskModel(deps, storedInput.data)))
      return fail(c, "MODEL_CAPABILITY_UNVERIFIED", "当前模型暂不可用，请选择其他模型", 400);
    const approvedPositions = await screenImageRetry(
      c,
      deps.moderate,
      storedInput.data,
      job.items,
      target.itemId,
    );
    const result = await deps.repository.retry(
      scope,
      jobId,
      key,
      target.itemId,
      deps.managedModelsOnly,
      approvedPositions,
    );
    return taskSubmissionResponse(c, deps.wake, result);
  });
}

export function registerImageTaskHistory(
  app: Hono<Env>,
  deps: ImageApiDependencies,
  delivery: ImageDeliveries | undefined,
) {
  // A task still queued while its owner polls means the submission wake was lost or the
  // consumer was busy; retry the wake at most every 15 seconds per task in this instance.
  const wokenAt = new Map<string, number>();
  const queuedJob = z.object({
    id: z.uuid(),
    status: z.enum(["queued", "running"]),
    recovery_due: z.boolean().optional(),
    created_at: z.coerce.date(),
  });
  const wakeIfStale = async (job: unknown) => {
    const queued = queuedJob.safeParse(job);
    if (!deps.wake || !queued.success) return;
    const now = Date.now();
    if (queued.data.status === "running" && !queued.data.recovery_due) return;
    if (queued.data.status === "queued" && now - queued.data.created_at.getTime() < 15000) return;
    if (now - (wokenAt.get(queued.data.id) ?? 0) < 15000) return;
    if (wokenAt.size > 1000) wokenAt.clear();
    wokenAt.set(queued.data.id, now);
    await deps.wake();
  };
  app.get("/image-tasks", async (c) => {
    const limit = z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .safeParse(c.req.query("limit"));
    const before = id.optional().safeParse(c.req.query("before"));
    const tool = imageToolSchema.optional().safeParse(c.req.query("tool"));
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
  app.get("/image-tasks/status", async (c) => {
    const parsed = z.array(z.uuid()).min(1).max(50).safeParse(c.req.query("ids")?.split(","));
    if (!parsed.success) return fail(c, "VALIDATION_ERROR", "任务编号无效", 400);
    const scope = c.get("principal");
    const jobs = await deps.repository.getMany(scope, [...new Set(parsed.data)]);
    // One recovery wake per batch; the consumer drains all durable due work.
    const recover = jobs.find((job) => {
      const value = queuedJob.safeParse(job);
      return (
        value.success &&
        ((value.data.status === "queued" &&
          Date.now() - value.data.created_at.getTime() >= 15000) ||
          value.data.recovery_due)
      );
    });
    if (recover) await wakeIfStale(recover);
    return c.json({ data: delivery ? await delivery.jobs(scope, jobs) : jobs });
  });
  app.get("/image-tasks/:id", async (c) => {
    const parsed = id.safeParse(c.req.param("id"));
    if (!parsed.success) return fail(c, "NOT_FOUND", "任务不存在", 404);
    const job = await deps.repository.get(c.get("principal"), parsed.data);
    if (!job) return fail(c, "NOT_FOUND", "任务不存在", 404);
    await wakeIfStale(job);
    return c.json(delivery ? (await delivery.jobs(c.get("principal"), [job]))[0] : job);
  });
  app.get("/image-assets/:id/latest-edit", async (c) => {
    const parsed = id.safeParse(c.req.param("id"));
    if (!parsed.success) return fail(c, "NOT_FOUND", "图片不存在", 404);
    const scope = c.get("principal");
    const job = await deps.repository.latestEdit(scope, parsed.data);
    return c.json({ job: job && delivery ? (await delivery.jobs(scope, [job]))[0] : job });
  });
}

export function registerImageTaskReconciliation(app: Hono<Env>, deps: ImageApiDependencies) {
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
}

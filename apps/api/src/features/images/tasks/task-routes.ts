import { BillingError, type CreditAuthorization } from "@lycoboai/billing";
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
  deps: ImageApiDependencies,
  result: T & { id: string },
  credit?: CreditAuthorization,
) {
  if (!result.replayed) {
    if (credit) await deps.wakeBilling?.(result.id);
    else await deps.wake?.();
  }
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

async function selectGenerationWallet(
  deps: ImageApiDependencies,
  scope: Env["Variables"]["principal"],
  cost: number,
  isRetry: boolean,
) {
  const { billing } = deps;
  if (!billing || (await deps.repository.wallet(scope)).balance >= cost) return;
  try {
    return await billing.generationAccount(scope, cost);
  } catch (error) {
    // 重试事务会先归还本地旧尝试的积分，再验证能否按原规则扣费。
    if (isRetry && error instanceof BillingError && error.code === "INSUFFICIENT_CREDITS") return;
    throw error;
  }
}

async function checkImageCredits(
  c: Context<Env>,
  deps: ImageApiDependencies,
  input: ImageGenerationInput,
  positions: readonly number[],
  isRetry = false,
): Promise<CreditAuthorization | undefined> {
  if (positions.length === 0) return;
  const scope = c.get("principal");
  const wallet = await selectGenerationWallet(
    deps,
    scope,
    positions.length * imageUnitCredits,
    isRetry,
  );
  const { moderate } = deps;
  if (!moderate) {
    if (wallet) throw new BillingError("BILLING_UNAVAILABLE");
    return;
  }
  // 两个钱包都须审核。购买积分逐图保存审核结果，便于按原交易冲正。
  const prompts = positions.map((position) => textileItemInput(input, position).prompt);
  const instructions = input.localEdit?.regions.map((region) => region.prompt) ?? [];
  const approvals = wallet
    ? await moderate(
        prompts.map((prompt) => [prompt, ...instructions].join("\n")),
        c.get("requestId"),
        c.req.raw.signal,
        true,
      )
    : await moderate([...prompts, ...instructions], c.get("requestId"), c.req.raw.signal);
  if (!wallet) return;
  if (
    !approvals ||
    approvals.length !== positions.length ||
    new Set(approvals).size !== positions.length
  )
    throw new BillingError("CREDIT_APPROVAL_INVALID");
  return {
    ...wallet,
    approvals: new Map(
      positions.flatMap((position, index) => {
        const approval = approvals[index];
        return approval ? [[position, approval]] : [];
      }),
    ),
  };
}

const retryItemsSchema = z.array(
  z.object({ id, position: z.number().int().nonnegative(), status: imageItemStatusSchema }),
);
const retryRequestSchema = z.object({ jobId: id, key: id, target: imageTaskRetrySchema });

async function screenImageRetry(
  c: Context<Env>,
  deps: ImageApiDependencies,
  input: ImageGenerationInput,
  items: unknown,
  itemId?: string,
) {
  if (!deps.moderate && !deps.billing) return;
  const candidates = retryItemsSchema
    .parse(items)
    .filter(
      (item) =>
        (!itemId || item.id === itemId) &&
        (item.status === "failed" || item.status === "needs_reconciliation"),
    );
  const positions = candidates.map((item) => item.position);
  const credit = await checkImageCredits(c, deps, input, positions, true);
  return { positions, credit };
}

async function parseRetryRequest(c: Context<Env>) {
  const body = await c.req.text();
  return retryRequestSchema.safeParse({
    jobId: c.req.param("jobId"),
    key: c.req.header("Idempotency-Key"),
    target: body ? JSON.parse(body) : {},
  });
}

async function supportedRetryInput(deps: ImageApiDependencies, input: unknown) {
  const stored = imageGenerationInputSchema.safeParse(input);
  if (stored.success && (await supportsTaskModel(deps, stored.data))) return stored.data;
  return undefined;
}

/** 通过统一审核、钱包和持久队列接收网页或自动化生图请求。 */
export async function submitImageTask(
  c: Context<Env>,
  deps: ImageApiDependencies,
  input: z.infer<typeof imageTaskSubmissionSchema>,
  key: string,
) {
  if (!deps.enabled) return fail(c, "GENERATION_NOT_CONFIGURED", "生图服务尚未启用", 503);
  const { userPrompt, ...modelInput } = input;
  const normalized = normalizeSubmittedTask(modelInput);
  const scope = c.get("principal");
  const submitted = { ...normalized, userPrompt };
  if (deps.billing) {
    const replay = await deps.repository.replayImageSubmission(scope, submitted, key);
    if (replay) return c.json(replay);
  }
  const positions = Array.from({ length: normalized.count }, (_, index) => index);
  const [supported, acceptedUploads, credit] = await Promise.all([
    supportsTaskModel(deps, normalized),
    prepareReferenceUploads(deps, scope, normalized.referenceAssetIds),
    checkImageCredits(c, deps, normalized, positions),
  ]);
  if (!supported)
    return fail(c, "MODEL_CAPABILITY_UNVERIFIED", "当前模型暂不可用，请选择其他模型", 400);
  const result = await deps.repository.create(
    scope,
    submitted,
    key,
    imageUnitCredits,
    deps.managedModelsOnly,
    acceptedUploads,
    ...(credit ? [credit] : []),
  );
  return taskSubmissionResponse(c, deps, result, credit);
}

/** 校验任务与服务端上传意图，再原子接收付费生成。 */
export function registerImageTaskSubmission(app: Hono<Env>, deps: ImageApiDependencies) {
  app.post("/image-tasks", async (c) => {
    if (!deps.enabled) return fail(c, "GENERATION_NOT_CONFIGURED", "生图服务尚未启用", 503);
    const input = imageTaskSubmissionSchema.safeParse(await c.req.json());
    const key = id.safeParse(c.req.header("Idempotency-Key"));
    if (!input.success || !key.success)
      return fail(c, "VALIDATION_ERROR", "请检查参数和 Idempotency-Key", 400);
    return submitImageTask(c, deps, input.data, key.data);
  });
  app.post("/image-tasks/:jobId/retry", async (c) => {
    if (!deps.enabled) return fail(c, "GENERATION_NOT_CONFIGURED", "生图服务尚未启用", 503);
    const request = await parseRetryRequest(c);
    if (!request.success) return fail(c, "VALIDATION_ERROR", "重试图片参数无效", 400);
    const { jobId, key, target } = request.data;
    const scope = c.get("principal");
    if (deps.billing && (await deps.repository.replayImageRetry(scope, jobId, key, target.itemId)))
      return c.json({ id: jobId, replayed: true });
    const job = await deps.repository.get(scope, jobId);
    if (!job) return fail(c, "NOT_FOUND", "任务不存在", 404);
    if (await providerRetryService(deps)(scope, jobId, target.itemId)) {
      await deps.wake?.();
      return c.json({ id: jobId, replayed: false }, 202);
    }
    const storedInput = await supportedRetryInput(deps, job.input);
    if (!storedInput)
      return fail(c, "MODEL_CAPABILITY_UNVERIFIED", "当前模型暂不可用，请选择其他模型", 400);
    const approved = await screenImageRetry(c, deps, storedInput, job.items, target.itemId);
    const result = await deps.repository.retry(
      scope,
      jobId,
      key,
      target.itemId,
      deps.managedModelsOnly,
      approved?.positions,
      approved?.credit,
    );
    return taskSubmissionResponse(c, deps, result, approved?.credit);
  });
}

/** 注册任务历史、状态查询和可靠队列的恢复入口。 */
export function registerImageTaskHistory(
  app: Hono<Env>,
  deps: ImageApiDependencies,
  delivery: ImageDeliveries | undefined,
) {
  // 查询排队任务可恢复丢失的唤醒，每个任务在此实例内最多每 15 秒补一次。
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
    // 同批状态查询只唤醒一次，由消费者领取全部到期待执行项。
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

/** 允许组织管理员依证据核对失败，并沿用原账本结算。 */
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

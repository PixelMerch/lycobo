import { createHash } from "node:crypto";
import { automationDownloadBatchLimit, imageAutomationDownloadPath } from "@lycoboai/contracts";
import { openProviderKey, sealProviderKey } from "@lycoboai/generation";
import type { Context, Hono } from "hono";
import { z } from "zod";
import { checkImageRequestLimit } from "../rate-limit";
import { type Env, fail, type ImageApiDependencies, id } from "../route-context";

const downloadContext = "image-automation-task-download:v2";
const downloadLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const taskIdsSchema = z
  .array(id)
  .min(1)
  .max(automationDownloadBatchLimit)
  .refine((ids) => new Set(ids).size === ids.length);
const downloadClaim = z.strictObject({
  userId: id,
  organizationId: id,
  taskIds: taskIdsSchema,
  keyDigest: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.number().int(),
});

/** 为一批归属已验证的任务签发下载凭证，供本机跨重启恢复。 */
export async function prepareAutomationTaskDownloads(
  c: Context<Env>,
  { repository, automationKeySecret, signAsset }: ImageApiDependencies,
  taskIds: string[],
) {
  if (!automationKeySecret || !signAsset)
    return fail(c, "GENERATION_NOT_CONFIGURED", "自动下载暂不可用", 503);
  const { userId, organizationId } = c.get("principal");
  const scope = { userId, organizationId };
  const keyDigest = createHash("sha256")
    .update(c.req.header("Authorization")?.slice(7) ?? "")
    .digest("hex");
  const ownedTasks = await repository.automation.downloadTasks(scope, taskIds, keyDigest);
  if (ownedTasks.length !== taskIds.length)
    return fail(c, "NOT_FOUND", "部分任务不存在或已归档", 404);
  const expiresAt = Date.now() + downloadLifetimeMs;
  const tasks = ownedTasks.map(({ id, publicId }) => ({ id, publicId }));
  const claim = JSON.stringify({
    ...scope,
    taskIds: tasks.map((task) => task.id),
    keyDigest,
    expiresAt,
  });
  const downloadToken = await sealProviderKey(claim, automationKeySecret, downloadContext);
  const downloadUrl = new URL(`/api/v1${imageAutomationDownloadPath}`, c.req.url).href;
  return c.json({ tasks, downloadUrl, downloadToken, expiresAt });
}

async function readDownloadClaim(token: string | undefined, secret: string) {
  if (!token?.startsWith("Bearer ") || token.length > 2000) return null;
  try {
    const plaintext = await openProviderKey(token.slice(7), secret, downloadContext);
    const claim = downloadClaim.parse(JSON.parse(plaintext));
    return claim.expiresAt > Date.now() ? claim : null;
  } catch {
    return null;
  }
}

type Task = Awaited<
  ReturnType<ImageApiDependencies["repository"]["automation"]["downloadTasks"]>
>[number];

function describeDownload(task: Task | undefined, taskId: string, urls: Map<string, string>) {
  if (!task) return { taskId, status: "unavailable" };
  const status = task.status;
  if (status === "queued" || status === "running") return { taskId, status };
  if (task.asset_ids.some((assetId) => !urls.has(assetId))) return { taskId, status: "running" };
  return {
    taskId,
    status,
    files: task.asset_ids.map((assetId, index) => ({
      assetId,
      index: index + 1,
      url: urls.get(assetId),
    })),
  };
}

async function taskDownloadManifest(
  c: Context<Env>,
  repository: ImageApiDependencies["repository"],
  signAsset: NonNullable<ImageApiDependencies["signAsset"]>,
  claim: z.infer<typeof downloadClaim>,
  requested: string[],
) {
  const tasks = await repository.automation.downloadTasks(claim, requested, claim.keyDigest);
  const ids = [...new Set(tasks.flatMap((task) => task.asset_ids))];
  const assets = ids.length ? await repository.assetLocations(claim, ids) : [];
  const urls = new Map(
    await Promise.all(
      assets.map(
        async ({ id, objectKey }) =>
          [id, (await signAsset(objectKey, "agent")).download_url] as const,
      ),
    ),
  );
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const entries = requested.map((taskId) => describeDownload(byId.get(taskId), taskId, urls));
  const retryAfterSeconds = entries.some((task) => task.status === "running") ? 30 : 60;
  return c.json({ tasks: entries, retryAfterSeconds });
}

/** 同一凭证一次查询多个任务，只向已完成的任务发放原图地址。 */
export function registerAutomationTaskDownloads(app: Hono<Env>, deps: ImageApiDependencies) {
  app.post(imageAutomationDownloadPath, async (c) => {
    const { repository, automationKeySecret, signAsset, rateLimits } = deps;
    if (!automationKeySecret || !signAsset)
      return fail(c, "GENERATION_NOT_CONFIGURED", "自动下载暂不可用", 503);
    const claim = await readDownloadClaim(c.req.header("Authorization"), automationKeySecret);
    if (!claim) return fail(c, "UNAUTHORIZED", "任务下载凭证无效或已过期", 401);
    const limited = rateLimits && (await checkImageRequestLimit(c, rateLimits, claim.userId));
    if (limited) return limited;
    const input = z
      .strictObject({ taskIds: taskIdsSchema })
      .safeParse(await c.req.json().catch(() => null));
    if (!input.success) return fail(c, "VALIDATION_ERROR", "任务列表无效", 400);
    const allowed = new Set(claim.taskIds);
    if (input.data.taskIds.some((taskId) => !allowed.has(taskId)))
      return fail(c, "FORBIDDEN", "下载凭证不允许读取该任务", 403);
    return taskDownloadManifest(c, repository, signAsset, claim, input.data.taskIds);
  });
}

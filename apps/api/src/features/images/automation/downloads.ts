import { imageAutomationDownloadPath } from "@lycoboai/contracts";
import { openProviderKey, sealProviderKey } from "@lycoboai/generation";
import type { Context, Hono } from "hono";
import { z } from "zod";
import { checkImageRequestLimit } from "../rate-limit";
import { type Env, fail, type ImageApiDependencies, id } from "../route-context";

const downloadContext = "image-automation-task-download:v1";
const downloadLifetimeMs = 2 * 60 * 60 * 1000;
const downloadClaim = z.strictObject({
  userId: id,
  organizationId: id,
  taskId: id,
  expiresAt: z.number().int(),
});

/** 仅为连接器拥有的单个任务签发下载凭证，凭证不能提交或读取其他任务。 */
export async function prepareAutomationTaskDownload(
  c: Context<Env>,
  { repository, automationKeySecret, signAsset }: ImageApiDependencies,
  taskId: string,
) {
  if (!automationKeySecret || !signAsset)
    return fail(c, "GENERATION_NOT_CONFIGURED", "自动下载暂不可用", 503);
  const { userId, organizationId } = c.get("principal");
  const scope = { userId, organizationId };
  const task = await repository.automation.result(scope, taskId);
  if (!task) return fail(c, "NOT_FOUND", "任务不存在或已归档", 404);
  const expiresAt = Date.now() + downloadLifetimeMs;
  const claim = JSON.stringify({ ...scope, taskId: task.id, expiresAt });
  const downloadToken = await sealProviderKey(claim, automationKeySecret, downloadContext);
  const downloadUrl = new URL(`/api/v1${imageAutomationDownloadPath}/${task.id}`, c.req.url).href;
  return c.json({
    taskId: task.id,
    publicId: task.publicId,
    downloadUrl,
    downloadToken,
    expiresAt,
  });
}

async function readDownloadClaim(token: string | undefined, secret: string) {
  if (!token?.startsWith("Bearer ") || token.length > 700) return null;
  try {
    const plaintext = await openProviderKey(token.slice(7), secret, downloadContext);
    const claim = downloadClaim.parse(JSON.parse(plaintext));
    return claim.expiresAt > Date.now() ? claim : null;
  } catch {
    return null;
  }
}

async function taskDownloadManifest(
  c: Context<Env>,
  repository: ImageApiDependencies["repository"],
  signAsset: NonNullable<ImageApiDependencies["signAsset"]>,
  claim: z.infer<typeof downloadClaim>,
) {
  const task = await repository.automation.result(claim, claim.taskId, true);
  if (!task) return fail(c, "NOT_FOUND", "任务不存在或已归档", 404);
  if (task.status === "queued" || task.status === "running") {
    const retryAfterSeconds = task.status === "queued" ? 60 : 30;
    c.header("Retry-After", String(retryAfterSeconds));
    return c.json({ status: task.status, retryAfterSeconds }, 202);
  }
  // 完成前不读取素材表或签发图片地址。部分成功时仍提供已保存的原图。
  const assets = task.asset_ids.length
    ? await repository.assetLocations(claim, task.asset_ids)
    : [];
  const keys = new Map(assets.map(({ id, objectKey }) => [id, objectKey]));
  if (keys.size < new Set(task.asset_ids).size) {
    c.header("Retry-After", "30");
    return fail(c, "SERVICE_UNAVAILABLE", "原图暂不可用，请稍后重试", 503);
  }
  const files = await Promise.all(
    task.asset_ids.flatMap((assetId, index) => {
      const key = keys.get(assetId);
      if (!key) return [];
      return signAsset(key, "agent").then((delivery) => ({
        assetId,
        index: index + 1,
        url: delivery.download_url,
      }));
    }),
  );
  return c.json({ status: task.status, files });
}

/** 供本地下载进程读取单任务的状态或一次性领取该任务的全部下载地址。 */
export function registerAutomationTaskDownloads(app: Hono<Env>, deps: ImageApiDependencies) {
  app.get(`${imageAutomationDownloadPath}/:taskId`, async (c) => {
    const { repository, automationKeySecret, signAsset, rateLimits } = deps;
    if (!automationKeySecret || !signAsset)
      return fail(c, "GENERATION_NOT_CONFIGURED", "自动下载暂不可用", 503);
    const claim = await readDownloadClaim(c.req.header("Authorization"), automationKeySecret);
    if (!claim || claim.taskId !== c.req.param("taskId"))
      return fail(c, "UNAUTHORIZED", "任务下载凭证无效或已过期", 401);
    const limited = rateLimits && (await checkImageRequestLimit(c, rateLimits, claim.userId));
    return limited ?? taskDownloadManifest(c, repository, signAsset, claim);
  });
}

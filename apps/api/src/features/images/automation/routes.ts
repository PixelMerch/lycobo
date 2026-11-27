import {
  type ImageAutomationSetInput,
  imageAutomationInputSchema,
  imageAutomationKeyCopyPath,
  imageAutomationKeyCopySchema,
  imageAutomationKeyPath,
  imageAutomationMcpPath,
  imageAutomationPath,
  imageTaskSubmissionSchema,
} from "@lycoboai/contracts";
import { openProviderKey, sealProviderKey } from "@lycoboai/generation";
import type { Context, Hono } from "hono";
import type { z } from "zod";
import { checkImageRequestLimit } from "../rate-limit";
import { type Env, fail, type ImageApiDependencies, id } from "../route-context";
import { submitImageTask } from "../tasks/task-routes";
import { serveImageAutomationMcp } from "./mcp";

const keyPath = imageAutomationKeyPath;
const generationPath = `${imageAutomationPath}/generations`;
const forbidden = (c: Context<Env>) => fail(c, "FORBIDDEN", "仅企业账号可使用生图 API", 403);

function submitAutomation(
  c: Context<Env>,
  deps: ImageApiDependencies,
  input: z.infer<typeof imageAutomationInputSchema>,
  key: string,
  submissionSource?: "mcp",
) {
  const task = imageTaskSubmissionSchema.parse({ ...input, model: "gpt-image-2.6" });
  return submitImageTask(c, deps, task, key, submissionSource);
}

async function submitAutomationSet(
  c: Context<Env>,
  deps: ImageApiDependencies,
  input: ImageAutomationSetInput,
  key: string,
) {
  if (!deps.enabled) return fail(c, "GENERATION_NOT_CONFIGURED", "生图服务尚未启用", 503);
  const plan = await deps.repository.variation.saveAutomationPlan(c.get("principal"), input, key);
  const task = imageTaskSubmissionSchema.parse({
    prompt: input.title,
    userPrompt: input.title,
    resolution: input.resolution,
    model: "gpt-image-2.6",
    count: plan.items.length,
    variation: { version: 1, planId: plan.id, items: plan.items },
  });
  return submitImageTask(c, deps, task, key, "mcp");
}

async function limitAutomationSubmission(
  c: Context<Env>,
  deps: ImageApiDependencies,
  run: () => Promise<Response>,
) {
  // MCP 握手和查询使用通用额度，提交再使用该账号的生图额度。
  const limited =
    deps.rateLimits &&
    (await checkImageRequestLimit(c, deps.rateLimits, c.get("principal").userId, "generation"));
  return limited ?? run();
}

async function automationResult(c: Context<Env>, deps: ImageApiDependencies, taskId: string) {
  const scope = c.get("principal");
  const { repository, signAsset } = deps;
  const task = await repository.automation.result(scope, taskId);
  if (!task) return fail(c, "NOT_FOUND", "任务不存在", 404);
  const pending = task.status === "queued" || task.status === "running";
  if (pending) c.header("Retry-After", "10");
  const assets =
    signAsset && task.asset_ids.length
      ? await repository.assetLocations(scope, task.asset_ids)
      : [];
  const images = signAsset
    ? await Promise.all(
        assets.map(async ({ objectKey }) => {
          const signed = await signAsset(objectKey);
          return {
            url: signed.download_url,
            expiresAt: new Date(signed.expires_at * 1000).toISOString(),
          };
        }),
      )
    : [];
  return c.json({
    id: taskId,
    status: task.status,
    images,
    ...(pending && { retryAfterSeconds: 10 }),
  });
}

async function automationPreview(
  c: Context<Env>,
  { repository, store }: ImageApiDependencies,
  taskId: string,
  imageIndex: number,
) {
  if (!store.readDisplayThumbnail) return null;
  const scope = c.get("principal");
  // 先验证当前账号拥有任务，再按工作区解析选中的输出素材。
  const task = await repository.automation.result(scope, taskId);
  const assetId = task?.asset_ids[imageIndex - 1];
  if (!assetId) return null;
  const [asset] = await repository.assetLocations(scope, [assetId]);
  return asset ? store.readDisplayThumbnail(asset.objectKey) : null;
}

function registerAutomationKeys(app: Hono<Env>, deps: ImageApiDependencies) {
  const keys = deps.repository.automation;
  const secret = deps.automationKeySecret;
  const context = ({ organizationId, userId }: Env["Variables"]["principal"]) =>
    `image-automation-key:${organizationId}:${userId}`;
  app.get(keyPath, async (c) => {
    const status = c.get("enterpriseSession") && (await keys.status(c.get("principal")));
    return status ? c.json(status) : forbidden(c);
  });
  app.post(keyPath, async (c) => {
    if (!c.get("enterpriseSession")) return forbidden(c);
    if (!secret) return fail(c, "AUTH_NOT_CONFIGURED", "生图 Key 加密暂未配置", 503);
    const scope = c.get("principal");
    const issued = await keys.rotate(scope, (key) => sealProviderKey(key, secret, context(scope)));
    return issued ? c.json(issued, 201) : forbidden(c);
  });
  // 使用写请求的可信来源校验，避免页面预取或跨站请求取得密钥。
  app.post(imageAutomationKeyCopyPath, async (c) => {
    if (!c.get("enterpriseSession")) return forbidden(c);
    if (!secret) return fail(c, "AUTH_NOT_CONFIGURED", "生图 Key 加密暂未配置", 503);
    const scope = c.get("principal");
    const ciphertext = await keys.keyCiphertext(scope);
    if (!ciphertext) return fail(c, "NOT_FOUND", "没有可复制的生图 Key，请签发或更换后重试", 404);
    const key = await openProviderKey(ciphertext, secret, context(scope));
    return c.json(imageAutomationKeyCopySchema.parse({ key }));
  });
  app.delete(keyPath, async (c) => {
    const revoked = c.get("enterpriseSession") && (await keys.revoke(c.get("principal")));
    return revoked ? c.json({ expiresAt: null }) : forbidden(c);
  });
}

/** 只允许企业会话管理 Key，专用 Key 通过共用计费队列访问自己的生图任务。 */
export function registerImageAutomation(app: Hono<Env>, deps: ImageApiDependencies) {
  registerAutomationKeys(app, deps);
  app.post(generationPath, async (c) => {
    const input = imageAutomationInputSchema.safeParse(await c.req.json());
    const key = id.safeParse(c.req.header("Idempotency-Key"));
    if (!input.success || !key.success)
      return fail(c, "VALIDATION_ERROR", "请检查提示词、分辨率和 Idempotency-Key", 400);
    return submitAutomation(c, deps, input.data, key.data);
  });
  app.get(`${generationPath}/:taskId`, async (c) => {
    const task = id.safeParse(c.req.param("taskId"));
    return task.success
      ? automationResult(c, deps, task.data)
      : fail(c, "NOT_FOUND", "任务不存在", 404);
  });
  app.get(imageAutomationMcpPath, (c) => c.body(null, 405, { Allow: "POST" }));
  app.post(imageAutomationMcpPath, async (c) => {
    const origin = c.req.header("Origin");
    if (origin && origin !== new URL(c.req.url).origin)
      return fail(c, "FORBIDDEN", "不支持该连接来源", 403);
    return serveImageAutomationMcp(c, {
      submit: (input, key) =>
        limitAutomationSubmission(c, deps, () => submitAutomation(c, deps, input, key, "mcp")),
      submitSet: (input, key) =>
        limitAutomationSubmission(c, deps, () => submitAutomationSet(c, deps, input, key)),
      result: (taskId) => automationResult(c, deps, taskId),
      preview: (taskId, imageIndex) => automationPreview(c, deps, taskId, imageIndex),
    });
  });
}

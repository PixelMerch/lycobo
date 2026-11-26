import {
  imageAutomationInputSchema,
  imageAutomationMcpPath,
  imageAutomationPath,
  imageTaskSubmissionSchema,
} from "@lycoboai/contracts";
import type { Context, Hono } from "hono";
import type { z } from "zod";
import { checkImageRequestLimit } from "../rate-limit";
import { type Env, fail, type ImageApiDependencies, id } from "../route-context";
import { submitImageTask } from "../tasks/task-routes";
import { serveImageAutomationMcp } from "./mcp";

const keyPath = `${imageAutomationPath}/key`;
const generationPath = `${imageAutomationPath}/generations`;
const forbidden = (c: Context<Env>) => fail(c, "FORBIDDEN", "仅企业账号可使用生图 API", 403);

function submitAutomation(
  c: Context<Env>,
  deps: ImageApiDependencies,
  input: z.infer<typeof imageAutomationInputSchema>,
  key: string,
) {
  const task = imageTaskSubmissionSchema.parse({ ...input, model: "gpt-image-2.6" });
  return submitImageTask(c, deps, task, key);
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

/** 只允许企业会话管理 Key，专用 Key 通过共用计费队列访问自己的生图任务。 */
export function registerImageAutomation(app: Hono<Env>, deps: ImageApiDependencies) {
  const keys = deps.repository.automation;
  app.get(keyPath, async (c) => {
    const status = c.get("enterpriseSession") && (await keys.status(c.get("principal")));
    return status ? c.json(status) : forbidden(c);
  });
  app.post(keyPath, async (c) => {
    const issued = c.get("enterpriseSession") && (await keys.rotate(c.get("principal")));
    return issued ? c.json(issued, 201) : forbidden(c);
  });
  app.delete(keyPath, async (c) => {
    const revoked = c.get("enterpriseSession") && (await keys.revoke(c.get("principal")));
    return revoked ? c.json({ expiresAt: null }) : forbidden(c);
  });

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
    return serveImageAutomationMcp(
      c,
      async (input, key) => {
        // MCP 握手和查询走通用额度，实际提交另外使用同一账号的生图额度。
        const limited =
          deps.rateLimits &&
          (await checkImageRequestLimit(
            c,
            deps.rateLimits,
            c.get("principal").userId,
            "generation",
          ));
        return limited ?? submitAutomation(c, deps, input, key);
      },
      (taskId) => automationResult(c, deps, taskId),
    );
  });
}

import {
  storyboardOriginalImageLimit,
  videoCreateSchema,
  videoModel,
  videoReferenceUnavailableMessage,
  videoUnitCredits,
} from "@lycoboai/contracts";
import { Hono } from "hono";
import { z } from "zod";
import { enterprisePrincipal } from "../auth/principal";
import type { EnterpriseAuth } from "../auth/service";
import { type GenerationModerator, ModerationError } from "../moderation/creem-moderation";
import type { videoService } from "./service";
export type VideoApiDependencies = { service: ReturnType<typeof videoService> };

const fail = (code: string, message: string, status: 400 | 401 | 403 | 404 | 409 | 429 | 503) =>
  new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function videoFailure(error: Error) {
  if (error instanceof ModerationError)
    return fail(error.code, error.failure.message, error.failure.status);
  if (error instanceof z.ZodError)
    return fail("VALIDATION_ERROR", "请检查视频描述、参考图片和时长", 400);
  const code = z.object({ code: z.string() }).safeParse(error);
  const symbol = code.success ? code.data.code : error.message;
  if (symbol === "INSUFFICIENT_CREDITS") return fail(symbol, "积分不足，请充值后重试", 409);
  if (symbol === "REFERENCE_NOT_FOUND") return fail(symbol, "参考图片不存在或不属于当前账号", 400);
  if (symbol === "VIDEO_REFERENCES_UNAVAILABLE")
    return fail(symbol, videoReferenceUnavailableMessage, 503);
  if (symbol === "IDEMPOTENCY_CONFLICT")
    return fail(symbol, "提交编号已用于其他内容，请重新确认", 409);
  if (symbol === "RATE_LIMITED") return fail(symbol, "请等待已有视频任务完成或核对后再提交", 429);
  if (symbol === "FORBIDDEN") return fail(symbol, "没有访问权限", 403);
  return fail("GENERATION_NOT_CONFIGURED", "视频服务暂时不可用，请稍后重试", 503);
}

/** 处理已配置的视频任务，复用图片服务的生成前审核。 */
export function videoRoutes(
  deps: VideoApiDependencies | undefined,
  auth: EnterpriseAuth | undefined,
  moderate?: GenerationModerator,
) {
  const app = new Hono();
  app.use("*", async (c, next) => {
    if (!/^\/api\/v1\/video-(model|tasks)(\/|$)/.test(c.req.path)) {
      await next();
      return;
    }
    if (!auth) return fail("AUTH_NOT_CONFIGURED", "登录服务暂不可用", 503);
    if (!(await enterprisePrincipal(c, auth))) return fail("UNAUTHORIZED", "请先登录", 401);
    await next();
  });
  app.get("/video-model", (c) =>
    c.json({
      enabled: !!deps,
      referenceImagesEnabled: deps?.service.referenceImagesEnabled ?? false,
      storyboardHistory: !!deps,
      maxStoryboardOriginalImages: storyboardOriginalImageLimit,
      model: videoModel,
      resolution: "768p",
      unitCredits: videoUnitCredits,
    }),
  );
  app.onError(videoFailure);
  app.post("/video-tasks", async (c) => {
    if (!deps || !auth)
      return fail("GENERATION_NOT_CONFIGURED", "视频服务配置不完整，请联系管理员", 503);
    const identity = await enterprisePrincipal(c, auth);
    if (!identity) return fail("UNAUTHORIZED", "请先登录", 401);
    const key = z.uuid().parse(c.req.header("Idempotency-Key"));
    const input = videoCreateSchema.parse(await c.req.json().catch(() => null));
    await moderate?.([input.prompt], key, c.req.raw.signal);
    return c.json(await deps.service.create(identity.user, input, key), 202);
  });
  app.get("/video-tasks", async (c) => {
    if (!deps || !auth) return c.json({ data: [] });
    const identity = await enterprisePrincipal(c, auth);
    if (!identity) return fail("UNAUTHORIZED", "请先登录", 401);
    const before = z.uuid().optional().parse(c.req.query("before"));
    return c.json(await deps.service.list(identity.user, before));
  });
  app.get("/video-tasks/:id", async (c) => {
    if (!deps || !auth) return fail("NOT_FOUND", "视频任务不存在", 404);
    const identity = await enterprisePrincipal(c, auth);
    if (!identity) return fail("UNAUTHORIZED", "请先登录", 401);
    const task = await deps.service.get(identity.user, z.uuid().parse(c.req.param("id")));
    return task ? c.json(task) : fail("NOT_FOUND", "视频任务不存在", 404);
  });
  return app;
}

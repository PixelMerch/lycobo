import { type Hook, zValidator } from "@hono/zod-validator";
import {
  businessCodes,
  type Capabilities,
  type CreateTaskInput,
  createTaskSchema,
  imageAutomationMcpPath,
} from "@lycoboai/contracts";
import { type Context, Hono, type MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { z } from "zod";
import { authRoutes } from "./features/auth/routes";
import type { EnterpriseAuth } from "./features/auth/service";
import { type ImageApiDependencies, imageRoutes } from "./features/images/routes";
import {
  providerWebhookRoutes,
  type WebhookConfig,
} from "./features/images/webhooks/provider-webhook";
import { type RealtimeDependencies, realtimeRoutes } from "./features/realtime/routes";
import { type VideoApiDependencies, videoRoutes } from "./features/videos/routes";
import { errorCategory, safeRequestPath } from "./request-diagnostics";

const mappedCode = (code: string) => (Object.hasOwn(businessCodes, code) ? code : "INTERNAL_ERROR");
type ApiEnv = { Variables: { requestId: string; failure?: ReturnType<typeof errorCategory> } };
type ErrorReporter = (event: {
  event: string;
  requestId: string;
  name: string;
  errorCode?: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  businessCode: string;
}) => void;

function reportRequestFailure(
  c: Context<ApiEnv>,
  startedAt: number,
  symbol: string,
  reportError: ErrorReporter | undefined,
) {
  const shouldReport =
    c.res.status >= 500 || (c.res.status >= 400 && !["GET", "HEAD"].includes(c.req.method));
  if (!reportError || !shouldReport) return;
  const category = c.get("failure");
  reportError({
    event: "API_REQUEST_FAILED",
    requestId: c.get("requestId"),
    name: category?.name ?? "BusinessError",
    ...(category?.errorCode ? { errorCode: category.errorCode } : {}),
    method: c.req.method,
    path: safeRequestPath(c.req.raw),
    status: c.res.status,
    durationMs: Date.now() - startedAt,
    businessCode: mappedCode(symbol),
  });
}

async function jsonEnvelope(
  c: Context<ApiEnv>,
  startedAt: number,
  reportError: ErrorReporter | undefined,
) {
  const payload: unknown = await c.res.json();
  const success = c.res.status >= 200 && c.res.status < 300;
  const failure = z
    .object({ error: z.object({ code: z.string(), message: z.string() }) })
    .safeParse(payload);
  const symbol = failure.success ? failure.data.error.code : "INTERNAL_ERROR";
  reportRequestFailure(c, startedAt, symbol, reportError);
  const failureMessage = failure.success ? failure.data.error.message : "服务暂时不可用";
  const mapped = Object.entries(businessCodes).find(([name]) => name === symbol)?.[1];
  return {
    request_id: c.get("requestId"),
    code: success ? 0 : (mapped ?? businessCodes.INTERNAL_ERROR),
    message: success ? "成功" : failureMessage,
    data: success ? (payload ?? {}) : {},
    error: success ? {} : { code: symbol },
  };
}

function responseEnvelope(reportError: ErrorReporter | undefined): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    const startedAt = Date.now();
    c.set("requestId", crypto.randomUUID());
    c.header("X-Request-Id", c.get("requestId"));
    c.header("Cache-Control", "no-store");
    await next();
    // MCP 客户端直接读取 JSON-RPC 协议响应，不能套用站内 REST 外层结构。
    if (c.req.path === `/api/v1${imageAutomationMcpPath}`) return;
    if (c.req.method === "HEAD" || !c.res.headers.get("Content-Type")?.includes("application/json"))
      return;
    const envelope = await jsonEnvelope(c, startedAt, reportError);
    const headers = new Headers(c.res.headers);
    headers.delete("Content-Length");
    headers.delete("ETag");
    c.res = new Response(JSON.stringify(envelope), { status: c.res.status, headers });
  };
}

function requestSizeLimit(maxSize: number) {
  return bodyLimit({
    maxSize,
    onError: (c) =>
      c.json(
        {
          error: {
            code: "PAYLOAD_TOO_LARGE",
            message: "请求内容过大",
            requestId: c.get("requestId"),
          },
        },
        413,
      ),
  });
}

/** 组装 API 路由、统一响应和可注入的业务服务。 */
export function createApp(
  reportError?: ErrorReporter,
  images?: ImageApiDependencies,
  auth?: EnterpriseAuth,
  webhook?: WebhookConfig,
  videos?: VideoApiDependencies,
  realtime?: RealtimeDependencies,
) {
  const app = new Hono<ApiEnv>();
  app.use("*", responseEnvelope(reportError));
  app.use("*", secureHeaders());
  const generalSizeLimit = requestSizeLimit(11 * 1024 * 1024);
  app.use("/api/*", (c, next) => {
    // 上传路由在鉴权和限流后再读取文件，仍通过流式大小限制。
    if (images && c.req.method === "POST" && c.req.path === "/api/v1/image-assets") return next();
    return generalSizeLimit(c, next);
  });
  app.use("/api/*", async (c, next) => {
    if (c.req.path === "/api/v1/image-assets") {
      await next();
      return;
    }
    const limit = (c.req.path === "/api/v1/video-storyboards" ? 64 : 32) * 1024;
    return requestSizeLimit(limit)(c, next);
  });
  app.route("/api/v1/auth", authRoutes(auth));
  app.route("/api/v1", videoRoutes(videos, auth, images?.moderate));
  if (images && webhook)
    app.route(
      "/api/v1/webhooks",
      providerWebhookRoutes({ config: webhook, repository: images.repository, wake: images.wake }),
    );
  if (images?.billingWebhooks) app.route("/api/v1/webhooks", images.billingWebhooks);
  if (realtime) app.route("/api/v1", realtimeRoutes(realtime));
  if (images) app.route("/api/v1", imageRoutes(images));
  app.get("/api/health/live", (c) => c.json({ status: "ok", service: "lycoboai-api" }));
  app.get("/api/v1/system/capabilities", (c) => {
    const capabilities: Capabilities = {
      service: "lycoboai",
      stage: "foundation",
      generationEnabled: false,
      authenticationEnabled: false,
      enterprisePasswordLoginEnabled: !!auth?.config.passwordTurnstile,
    };
    return c.json(capabilities);
  });
  // 先验证共享契约，收费任务还需要鉴权、存储和持久化出队记录。
  app.post(
    "/api/v1/tasks",
    zValidator<
      typeof createTaskSchema,
      "json",
      ApiEnv,
      string,
      Hook<CreateTaskInput, ApiEnv, string, "json", object, typeof createTaskSchema>
    >("json", createTaskSchema, (result, c) => {
      if (!result.success)
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "请检查生成参数",
              requestId: c.get("requestId"),
            },
          },
          400,
        );
    }),
    (c) =>
      c.json(
        {
          error: {
            code: "GENERATION_NOT_CONFIGURED",
            message: "生图服务尚未启用",
            requestId: c.get("requestId"),
          },
        },
        503,
      ),
  );
  app.notFound((c) =>
    c.json(
      { error: { code: "NOT_FOUND", message: "接口不存在", requestId: c.get("requestId") } },
      404,
    ),
  );
  app.onError((error, c) => {
    const requestId = c.get("requestId");
    if (error instanceof HTTPException && error.status < 500) {
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "请求格式不正确", requestId } },
        error.status,
      );
    }
    c.set("failure", errorCategory(error));
    return c.json({ error: { code: "INTERNAL_ERROR", message: "服务暂时不可用", requestId } }, 500);
  });
  return app;
}

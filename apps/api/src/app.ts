import { type Hook, zValidator } from "@hono/zod-validator";
import { type Capabilities, type CreateTaskInput, createTaskSchema } from "@lycoboai/contracts";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";

import { type ImageApiDependencies, imageRoutes } from "./features/images/routes";

type ApiEnv = { Variables: { requestId: string } };
type ErrorReporter = (event: { requestId: string; name: string }) => void;

export function createApp(reportError: ErrorReporter = () => {}, images?: ImageApiDependencies) {
  const app = new Hono<ApiEnv>();
  app.use("*", async (c, next) => {
    c.set("requestId", crypto.randomUUID());
    c.header("X-Request-Id", c.get("requestId"));
    c.header("Cache-Control", "no-store");
    await next();
  });
  app.use("*", secureHeaders());
  app.use(
    "/api/*",
    bodyLimit({
      maxSize: 11 * 1024 * 1024,
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
    }),
  );
  app.use("/api/*", async (c, next) => {
    if (c.req.path !== "/api/v1/image-assets") {
      return bodyLimit({
        maxSize: 32 * 1024,
        onError: (ctx) =>
          ctx.json(
            {
              error: {
                code: "PAYLOAD_TOO_LARGE",
                message: "请求内容过大",
                requestId: c.get("requestId"),
              },
            },
            413,
          ),
      })(c, next);
    }
    await next();
  });
  if (images) app.route("/api/v1", imageRoutes(images));
  app.get("/api/health/live", (c) => c.json({ status: "ok", service: "lycoboai-api" }));
  app.get("/api/v1/system/capabilities", (c) => {
    const capabilities: Capabilities = {
      service: "lycoboai",
      stage: "foundation",
      generationEnabled: false,
      authenticationEnabled: false,
    };
    return c.json(capabilities);
  });
  // Validate the shared contract now; accepting paid work requires auth, storage and an outbox.
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
    reportError({ requestId, name: error.name });
    return c.json({ error: { code: "INTERNAL_ERROR", message: "服务暂时不可用", requestId } }, 500);
  });
  return app;
}

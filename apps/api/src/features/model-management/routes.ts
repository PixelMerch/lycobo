import {
  channelInputSchema,
  modelRouteInputSchema,
  providerInputSchema,
} from "@lycoboai/contracts";
import type { ImagePrincipal, ImageRepository } from "@lycoboai/db";
import { openProviderKey, sealProviderKey } from "@lycoboai/generation";
import { Hono } from "hono";
import { z } from "zod";
export function modelManagementRoutes(repository: ImageRepository, secret?: string) {
  const app = new Hono<{ Variables: { principal: ImagePrincipal } }>();
  app.use("*", async (c, next) => {
    if (!(await repository.models.isAdministrator(c.get("principal").userId)))
      return c.json({ error: { code: "FORBIDDEN", message: "需要平台管理员权限" } }, 403);
    await next();
  });
  app.get("/session", (c) => c.json({ userId: c.get("principal").userId }));
  app.get("/", async (c) =>
    c.json({ ...(await repository.models.list()), encryptionReady: !!secret }),
  );
  app.onError((error, c) =>
    c.json(
      {
        error: {
          code: error instanceof z.ZodError ? "VALIDATION_ERROR" : "GENERATION_NOT_CONFIGURED",
          message:
            error instanceof z.ZodError ? "请检查配置字段" : "操作未完成，请检查密钥配置和关联记录",
        },
      },
      error instanceof z.ZodError ? 400 : 409,
    ),
  );
  for (const path of ["/providers", "/providers/:id"])
    app.post(path, async (c) => {
      if (!secret)
        return c.json(
          {
            error: {
              code: "GENERATION_NOT_CONFIGURED",
              message: "服务端尚未配置模型密钥加密主密钥",
            },
          },
          503,
        );
      const input = providerInputSchema.parse(await c.req.json());
      const id = c.req.param("id");
      if (id) z.uuid().parse(id);
      const cipher = input.apiKey ? await sealProviderKey(input.apiKey, secret) : undefined;
      return c.json(
        await repository.models.saveProvider(c.get("principal").userId, id, input, cipher),
      );
    });
  for (const path of ["/channels", "/channels/:id"])
    app.post(path, async (c) => {
      const id = c.req.param("id");
      if (id) z.uuid().parse(id);
      return c.json(
        await repository.models.saveChannel(
          c.get("principal").userId,
          id,
          channelInputSchema.parse(await c.req.json()),
        ),
      );
    });
  app.post("/routes", async (c) =>
    c.json(
      await repository.models.saveRoute(
        c.get("principal").userId,
        modelRouteInputSchema.parse(await c.req.json()),
      ),
    ),
  );
  app.post("/providers/:id/test", async (c) => {
    const id = z.uuid().parse(c.req.param("id"));
    if (!secret) throw new Error("MODEL_SECRET_REQUIRED");
    const provider = await repository.models.provider(id);
    if (!provider) return c.json({ error: { code: "NOT_FOUND", message: "中转站不存在" } }, 404);
    const started = Date.now();
    try {
      const response = await fetch(new URL("/v1/models", provider.origin), {
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${await openProviderKey(provider.ciphertext, secret)}` },
      });
      await response.body?.cancel();
      return c.json({
        reachable: response.ok,
        httpStatus: response.status,
        latencyMs: Date.now() - started,
        generationVerified: false,
      });
    } catch {
      return c.json({
        reachable: false,
        httpStatus: null,
        latencyMs: Date.now() - started,
        generationVerified: false,
      });
    }
  });
  return app;
}

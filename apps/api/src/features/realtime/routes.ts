import { realtimeCursorSchema } from "@lycoboai/contracts";
import type { RealtimeRepository } from "@lycoboai/db";
import { Hono } from "hono";
import { z } from "zod";
import { enterprisePrincipal, trustedAuthRequest } from "../auth/principal";
import type { EnterpriseAuth } from "../auth/service";
import type { RealtimeHub } from "./object";

export type RealtimeDependencies = {
  repository: RealtimeRepository;
  hubs: DurableObjectNamespace<RealtimeHub>;
  auth: EnterpriseAuth;
};

/** 提供严格同源的实时连接、持久消息与已读操作，身份由服务端会话解析。 */
export function realtimeRoutes({ repository, hubs, auth }: RealtimeDependencies) {
  const app = new Hono();
  app.get("/realtime/release", async (c) => c.json({ release: await repository.release() }));
  app.get("/realtime/:channel", async (c) => {
    if (!trustedAuthRequest(c, auth))
      return c.json({ error: { code: "UNTRUSTED_ORIGIN", message: "请求来源不受信任" } }, 403);
    if (c.req.header("Upgrade")?.toLowerCase() !== "websocket")
      return c.text("需要 WebSocket 连接", 426);
    const cursor = realtimeCursorSchema.safeParse(c.req.query("cursor") ?? "0");
    if (!cursor.success)
      return c.json({ error: { code: "VALIDATION_ERROR", message: "无效的消息游标" } }, 400);
    const release = await repository.release();
    let channel = "public";
    let connection = {
      userId: crypto.randomUUID(),
      sessionId: "public",
      expiresAt: Date.now() + 86400000,
    };
    if (c.req.param("channel") !== "public") {
      if (c.req.param("channel") !== "connect") return c.notFound();
      const session = await enterprisePrincipal(c, auth);
      if (!session) return c.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, 401);
      channel = session.user.organizationId;
      connection = {
        userId: session.user.userId,
        sessionId: session.sessionId,
        expiresAt: session.expiresAt * 1000,
      };
    }
    // 丢弃浏览器的身份头，只把服务端验证后的身份传入内部 DO 通道。
    const response = await hubs.getByName(channel).fetch(
      new Request("https://realtime.internal/connect", {
        headers: {
          Upgrade: "websocket",
          "X-Realtime-Connection": JSON.stringify({ connection, cursor: cursor.data, release }),
        },
      }),
    );
    // DO fetch 响应的头不可变，复制时保留升级连接，让 Hono 安全添加安全头与请求 ID。
    return new Response(response.body, {
      status: response.status,
      headers: new Headers(response.headers),
      webSocket: response.webSocket,
    });
  });
  app.get("/notifications", async (c) => {
    const session = await enterprisePrincipal(c, auth);
    if (!session) return c.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, 401);
    const before = z.uuid().optional().safeParse(c.req.query("before"));
    if (!before.success)
      return c.json({ error: { code: "VALIDATION_ERROR", message: "消息游标无效" } }, 400);
    return c.json(await repository.notifications(session.user, before.data));
  });
  app.post("/notifications/:id/read", async (c) => {
    const session = await enterprisePrincipal(c, auth);
    if (!session) return c.json({ error: { code: "UNAUTHORIZED", message: "请先登录" } }, 401);
    const id = z.uuid().safeParse(c.req.param("id"));
    if (!id.success)
      return c.json({ error: { code: "VALIDATION_ERROR", message: "消息不存在" } }, 400);
    await repository.read(session.user, id.data);
    return c.json({});
  });
  return app;
}

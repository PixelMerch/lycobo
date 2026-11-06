import { createApp } from "../../apps/api/src/app";

const userId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";
const sessionId = "33333333-3333-4333-8333-333333333333";

/** 本地测试入口只使用隔离 DO，模拟鉴权依赖，不读线上身份或资源。 */
export async function realtimeRuntime(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/fixture/publish") {
    const input = await request.json();
    await env.REALTIME.getByName(input.channel ?? organizationId).publish(
      input.id,
      input.event,
      input.userId ?? null,
      input.sessions ?? [sessionId],
    );
    return Response.json({ ok: true });
  }
  const auth = {
    config: { origins: [url.origin] },
    authenticate: async (token) =>
      token === "fixture"
        ? {
            user: { organizationId, userId, role: "admin", account: "fixture" },
            sessionId,
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
          }
        : null,
  };
  const app = createApp(undefined, undefined, auth, undefined, undefined, {
    auth,
    hubs: env.REALTIME,
    repository: { release: async () => null },
  });
  app.onError((error, c) => {
    console.error(error.message);
    return c.text(error.message, 500);
  });
  return app.fetch(request);
}

import { emailCodeSendSchema, emailCodeVerifySchema } from "@lycoboai/contracts";
import { type Context, Hono } from "hono";
import { trustedAuthRequest } from "./principal";
import type { EnterpriseAuth } from "./service";
import { sendSupabaseEmailCode, verifySupabaseEmailCode } from "./supabase-email";

type EmailEnv = { Bindings: { incoming?: { socket: { remoteAddress?: string } } } };
type LoginResult = NonNullable<Awaited<ReturnType<EnterpriseAuth["socialLogin"]>>>;

function unavailable(c: Context) {
  return c.json({ error: { code: "AUTH_NOT_CONFIGURED", message: "邮箱登录暂不可用" } }, 503);
}

function limited(c: Context) {
  return c.json({ error: { code: "RATE_LIMITED", message: "请求过于频繁，请稍后再试" } }, 429);
}

function localAddress(c: Context<EmailEnv>) {
  // 本地服务只使用可信连接地址。开发代理下共享同一来源配额，不接受客户端伪造的转发头。
  return c.env?.incoming?.socket.remoteAddress ?? "local";
}

/** 提供同源邮箱验证码发送与登录，复用主站 HttpOnly 会话。 */
export function emailRoutes(
  auth: EnterpriseAuth | undefined,
  setSession: (c: Context, auth: EnterpriseAuth, result: LoginResult) => void,
) {
  const app = new Hono<EmailEnv>();
  const config = auth?.config.oauth;
  app.use("*", async (c, next) => {
    if (!auth || !config?.emailTurnstileSiteKey) return unavailable(c);
    if (!c.req.header("Origin") || !trustedAuthRequest(c, auth))
      return c.json({ error: { code: "UNTRUSTED_ORIGIN", message: "请求来源不受信任" } }, 403);
    await next();
  });
  app.post("/send", async (c) => {
    if (!auth || !config) return unavailable(c);
    const input = emailCodeSendSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success)
      return c.json(
        { error: { code: "VALIDATION_ERROR", message: "请检查邮箱并完成人机验证" } },
        400,
      );
    const { email, captchaToken } = input.data;
    if (!(await auth.allowEmailCode(email, localAddress(c), "send"))) return limited(c);
    const result = await sendSupabaseEmailCode(config, email, captchaToken);
    if (result === "limited") return limited(c);
    if (result === "captcha")
      return c.json({ error: { code: "VALIDATION_ERROR", message: "人机验证失败，请重试" } }, 400);
    return result === "sent" ? c.json({}) : unavailable(c);
  });
  app.post("/verify", async (c) => {
    if (!auth || !config) return unavailable(c);
    const input = emailCodeVerifySchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success)
      return c.json({ error: { code: "VALIDATION_ERROR", message: "请输入 6 位验证码" } }, 400);
    const { email, code } = input.data;
    if (!(await auth.allowEmailCode(email, localAddress(c), "verify"))) return limited(c);
    const result = await verifySupabaseEmailCode(config, email, code);
    if (result.status === "limited") return limited(c);
    if (result.status === "unavailable") return unavailable(c);
    if (result.status === "invalid")
      return c.json({ error: { code: "INVALID_CREDENTIALS", message: "验证码错误或已过期" } }, 401);
    const session = await auth.socialLogin({ externalId: result.externalId, email });
    if (!session) return unavailable(c);
    setSession(c, auth, session);
    return c.json(session.user);
  });
  return app;
}

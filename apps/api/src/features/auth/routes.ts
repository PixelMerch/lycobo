import { enterpriseLoginSchema, enterprisePasswordChangeSchema } from "@lycoboai/contracts";
import { type Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { EnterpriseAuth } from "./service";
export const enterpriseCookie = "lycobo_enterprise_session";
export const refreshCookie = "lycobo_enterprise_refresh";
const refreshPath = "/api/v1/auth";
function clearAuthCookies(c: Context, auth: EnterpriseAuth) {
  const flags = { secure: auth.config.secureCookie, sameSite: "Strict", httpOnly: true } as const;
  deleteCookie(c, enterpriseCookie, { ...flags, path: "/api" });
  deleteCookie(c, refreshCookie, { ...flags, path: refreshPath });
  deleteCookie(c, "lycobo_image_session", { path: "/api" });
}
function tokenResponse(
  c: Context,
  auth: EnterpriseAuth,
  result: NonNullable<Awaited<ReturnType<EnterpriseAuth["refresh"]>>>,
) {
  const { refreshToken, ...body } = result;
  const flags = { httpOnly: true, secure: auth.config.secureCookie, sameSite: "Strict" } as const;
  setCookie(c, enterpriseCookie, result.accessToken, {
    ...flags,
    path: "/api",
    maxAge: result.expiresIn,
  });
  setCookie(c, refreshCookie, refreshToken, {
    ...flags,
    path: refreshPath,
    maxAge: result.refreshExpiresIn,
  });
  deleteCookie(c, "lycobo_image_session", { path: "/api" });
  c.header("X-Auth-Expires-At", String(Math.floor(Date.now() / 1000) + result.expiresIn));
  return c.json(body);
}
export function trustedAuthRequest(c: Context, auth: EnterpriseAuth) {
  const origin = c.req.header("Origin");
  return (
    !!origin &&
    auth.config.origins.includes(origin) &&
    c.req.header("Sec-Fetch-Site") !== "cross-site"
  );
}
export async function enterprisePrincipal(c: Context, auth: EnterpriseAuth) {
  const authorization = c.req.header("Authorization");
  if (authorization !== undefined) {
    if (!authorization.startsWith("Bearer ")) return null;
    return auth.authenticate(authorization.slice(7));
  }
  if (c.req.header("Sec-Fetch-Site") === "cross-site") return null;
  if (!["GET", "HEAD"].includes(c.req.method) && !trustedAuthRequest(c, auth)) return null;
  const token = getCookie(c, enterpriseCookie);
  return token ? auth.authenticate(token) : null;
}
type Env = { Variables: { requestId: string } };
export function authRoutes(auth?: EnterpriseAuth) {
  const app = new Hono<Env>();
  const fail = (
    c: Context<Env>,
    code: string,
    message: string,
    status: 400 | 401 | 403 | 429 | 503,
  ) => c.json({ error: { code, message, requestId: c.get("requestId") } }, status);
  app.use("*", async (c, next) => {
    if (!auth) return fail(c, "AUTH_NOT_CONFIGURED", "企业账号登录服务暂未开放，请稍后再试。", 503);
    await next();
  });
  app.post("/enterprise/login", async (c) => {
    if (!auth) return fail(c, "AUTH_NOT_CONFIGURED", "登录服务尚未配置", 503);
    if (!trustedAuthRequest(c, auth)) return fail(c, "UNTRUSTED_ORIGIN", "请求来源不受信任", 403);
    const input = enterpriseLoginSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success) return fail(c, "VALIDATION_ERROR", "请输入有效的企业账号和密码", 400);
    const result = await auth.login(input.data.account, input.data.password);
    if ("error" in result) {
      if (result.error === "RATE_LIMITED") {
        c.header("Retry-After", "900");
        return fail(c, result.error, "登录尝试过于频繁，请稍后再试", 429);
      }
      return fail(c, result.error, "账号或密码错误", 401);
    }
    return tokenResponse(c, auth, result);
  });
  app.post("/refresh", async (c) => {
    if (!auth) return fail(c, "AUTH_NOT_CONFIGURED", "登录服务尚未配置", 503);
    if (!trustedAuthRequest(c, auth)) return fail(c, "UNTRUSTED_ORIGIN", "请求来源不受信任", 403);
    const token = getCookie(c, refreshCookie);
    const result = token ? await auth.refresh(token) : null;
    // A concurrent tab may already have rotated the shared cookie. Never clear it on rejection.
    return result
      ? tokenResponse(c, auth, result)
      : fail(c, "UNAUTHORIZED", "登录已过期，请重新登录", 401);
  });
  app.post("/password", async (c) => {
    if (!auth) return fail(c, "AUTH_NOT_CONFIGURED", "登录服务尚未配置", 503);
    const session = await enterprisePrincipal(c, auth);
    if (!session) return fail(c, "UNAUTHORIZED", "请先登录", 401);
    const input = enterprisePasswordChangeSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success) return fail(c, "VALIDATION_ERROR", "新密码需为 12 至 256 个字符", 400);
    if (
      !(await auth.changePassword(
        session.user.account,
        input.data.currentPassword,
        input.data.newPassword,
      ))
    )
      return fail(c, "INVALID_CREDENTIALS", "当前密码错误或会话已失效", 401);
    clearAuthCookies(c, auth);
    return c.json({});
  });
  app.get("/session", async (c) => {
    if (!auth) return fail(c, "AUTH_NOT_CONFIGURED", "登录服务尚未配置", 503);
    const session = await enterprisePrincipal(c, auth);
    if (session) c.header("X-Auth-Expires-At", String(session.expiresAt));
    return session ? c.json(session.user) : fail(c, "UNAUTHORIZED", "请先登录", 401);
  });
  app.post("/logout", async (c) => {
    if (!auth) return fail(c, "AUTH_NOT_CONFIGURED", "登录服务尚未配置", 503);
    if (!c.req.header("Authorization") && !trustedAuthRequest(c, auth))
      return fail(c, "UNTRUSTED_ORIGIN", "请求来源不受信任", 403);
    const session = await enterprisePrincipal(c, auth);
    if (session) await auth.revoke(session.sessionId);
    if (!c.req.header("Authorization")) {
      const token = getCookie(c, refreshCookie);
      if (token) await auth.revokeRefresh(token);
    }
    clearAuthCookies(c, auth);
    return c.json({});
  });
  return app;
}

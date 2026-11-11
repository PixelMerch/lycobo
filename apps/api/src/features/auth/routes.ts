import {
  enterpriseAvatarChangeSchema,
  enterpriseLocaleChangeSchema,
  enterpriseLoginSchema,
  enterprisePasswordChangeSchema,
  userNicknameChangeSchema,
} from "@lycoboai/contracts";
import { type Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { emailRoutes } from "./email-routes";
import { oauthRoutes } from "./oauth-routes";
import { enterpriseCookie, enterprisePrincipal, trustedAuthRequest } from "./principal";
import type { EnterpriseAuth } from "./service";
export const refreshCookie = "lycobo_enterprise_refresh";
const refreshPath = "/api/v1/auth";
function clearAuthCookies(c: Context, auth: EnterpriseAuth) {
  const flags = { secure: auth.config.secureCookie, sameSite: "Strict", httpOnly: true } as const;
  deleteCookie(c, enterpriseCookie, { ...flags, path: "/api" });
  deleteCookie(c, refreshCookie, { ...flags, path: refreshPath });
  deleteCookie(c, "lycobo_image_session", { path: "/api" });
}
function setAuthCookies(
  c: Context,
  auth: EnterpriseAuth,
  result: NonNullable<Awaited<ReturnType<EnterpriseAuth["refresh"]>>>,
) {
  const flags = { httpOnly: true, secure: auth.config.secureCookie, sameSite: "Strict" } as const;
  setCookie(c, enterpriseCookie, result.accessToken, {
    ...flags,
    path: "/api",
    maxAge: result.expiresIn,
  });
  setCookie(c, refreshCookie, result.refreshToken, {
    ...flags,
    path: refreshPath,
    maxAge: result.refreshExpiresIn,
  });
  deleteCookie(c, "lycobo_image_session", { path: "/api" });
  c.header("X-Auth-Expires-At", String(Math.floor(Date.now() / 1000) + result.expiresIn));
}
function tokenResponse(
  c: Context,
  auth: EnterpriseAuth,
  result: NonNullable<Awaited<ReturnType<EnterpriseAuth["refresh"]>>>,
) {
  setAuthCookies(c, auth, result);
  const { refreshToken: _, ...body } = result;
  return c.json(body);
}
type Env = { Variables: { requestId: string } };
/** 企业账号的登录、刷新、改密、个人偏好、会话与退出路由；未配置登录服务时统一返回 503。 */
export function authRoutes(auth?: EnterpriseAuth) {
  const app = new Hono<Env>();
  app.route("/oauth", oauthRoutes(auth, setAuthCookies));
  app.route("/email", emailRoutes(auth, setAuthCookies));
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
    // 其他标签页可能已经轮换了共用的 Cookie，拒绝时不要清除它。
    return result
      ? tokenResponse(c, auth, result)
      : fail(c, "UNAUTHORIZED", "登录已过期，请重新登录", 401);
  });
  app.post("/password", async (c) => {
    if (!auth) return fail(c, "AUTH_NOT_CONFIGURED", "登录服务尚未配置", 503);
    const session = await enterprisePrincipal(c, auth);
    if (!session) return fail(c, "UNAUTHORIZED", "请先登录", 401);
    if (session.user.loginMethod === "social")
      return fail(c, "FORBIDDEN", "第三方账号密码由登录服务商管理", 403);
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
  app.put("/avatar", async (c) => {
    if (!auth) return fail(c, "AUTH_NOT_CONFIGURED", "登录服务尚未配置", 503);
    // 只改当前会话对应的用户；Cookie 写请求的来源校验在 enterprisePrincipal 里完成。
    const session = await enterprisePrincipal(c, auth);
    if (!session) return fail(c, "UNAUTHORIZED", "请先登录", 401);
    const input = enterpriseAvatarChangeSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success) return fail(c, "VALIDATION_ERROR", "请选择有效的预设头像", 400);
    const { avatarPreset } = input.data;
    if (!(await auth.setAvatarPreset(session.user.userId, avatarPreset)))
      return fail(c, "UNAUTHORIZED", "请先登录", 401);
    return c.json({ ...session.user, avatarPreset });
  });
  app.put("/locale", async (c) => {
    if (!auth) return fail(c, "AUTH_NOT_CONFIGURED", "登录服务尚未配置", 503);
    const session = await enterprisePrincipal(c, auth);
    if (!session) return fail(c, "UNAUTHORIZED", "请先登录", 401);
    const input = enterpriseLocaleChangeSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success) return fail(c, "VALIDATION_ERROR", "请选择有效的界面语言", 400);
    const { preferredLocale } = input.data;
    const { userId } = session.user;
    if (!(await auth.setPreferredLocale(userId, preferredLocale)))
      return fail(c, "UNAUTHORIZED", "请先登录", 401);
    return c.json({ ...session.user, preferredLocale });
  });
  app.put("/nickname", async (c) => {
    if (!auth) return fail(c, "AUTH_NOT_CONFIGURED", "登录服务尚未配置", 503);
    const session = await enterprisePrincipal(c, auth);
    if (!session) return fail(c, "UNAUTHORIZED", "请先登录", 401);
    const input = userNicknameChangeSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success) return fail(c, "VALIDATION_ERROR", "请输入 1 至 64 字符的昵称", 400);
    const { nickname } = input.data;
    if (!(await auth.setNickname(session.user.userId, nickname)))
      return fail(c, "UNAUTHORIZED", "请先登录", 401);
    return c.json({ ...session.user, nickname });
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

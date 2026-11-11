import { randomBytes } from "node:crypto";
import { socialLoginInputSchema, socialProviders } from "@lycoboai/contracts";
import { type Context, Hono } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { z } from "zod";
import { trustedAuthRequest } from "./principal";
import type { EnterpriseAuth } from "./service";
import { exchangeSupabaseCode, supabaseAuthorizeUrl } from "./supabase-oauth";

const flowCookie = "lycobo_oauth_flow";
const cookiePath = "/api/v1/auth/oauth";
const flowDuration = 600;
const flowSchema = z.object({
  provider: z.enum(socialProviders),
  returnTo: z.string().max(900),
  verifier: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  expiresAt: z.number().int(),
});

function safeReturnTo(input: string) {
  if (!input.startsWith("/") || input.includes("\\")) return "/en";
  const url = new URL(input, "https://lycobo.invalid");
  if (url.origin !== "https://lycobo.invalid") return "/en";
  if (
    !/^\/(?:en|zh-CN)(?:\/?$|\/(?:commerce(?:\/|$)|workspace$|assets$|video$|membership$|inspiration$))/.test(
      url.pathname,
    )
  )
    return "/en";
  return `${url.pathname}${url.search}${url.hash}`;
}

function failurePath(returnTo: string) {
  const locale = /^\/zh-CN(?:\/|$)/.test(returnTo) ? "zh-CN" : "en";
  return `/${locale}/login?${new URLSearchParams({ returnTo, oauth: "failed" })}`;
}

type AuthResult = NonNullable<Awaited<ReturnType<EnterpriseAuth["socialLogin"]>>>;

async function completeOAuth(
  c: Context,
  auth: EnterpriseAuth | undefined,
  setSession: (c: Context, auth: EnterpriseAuth, result: AuthResult) => void,
) {
  c.header("Referrer-Policy", "no-referrer");
  const config = auth?.config.oauth;
  if (!auth || !config) return c.redirect(failurePath("/en"));
  const signed = await getSignedCookie(c, auth.config.secret, flowCookie);
  deleteCookie(c, flowCookie, { path: cookiePath, secure: auth.config.secureCookie });
  const flow = flowSchema.safeParse(signed ? JSON.parse(signed) : null);
  const code = c.req.query("code");
  const returnTo = safeReturnTo(flow.success ? flow.data.returnTo : "/en");
  if (!flow.success || flow.data.expiresAt < Date.now() || !code || code.length > 256)
    return c.redirect(failurePath(returnTo));
  try {
    const identity = await exchangeSupabaseCode(
      config,
      flow.data.provider,
      code,
      flow.data.verifier,
    );
    const session = identity && (await auth.socialLogin(identity));
    if (!session) return c.redirect(failurePath(returnTo));
    setSession(c, auth, session);
    // 回到登录页完成站内跳转，使 Strict 会话 Cookie 在同站页面发起的请求中生效；
    // oauth=success 只让登录页提示“登录成功”，登录状态仍以会话 Cookie 为准。
    const locale = /^\/zh-CN(?:\/|$)/.test(returnTo) ? "zh-CN" : "en";
    return c.redirect(`/${locale}/login?${new URLSearchParams({ returnTo, oauth: "success" })}`);
  } catch {
    // 外部响应可能包含认证凭据，只给浏览器返回通用失败状态。
    return c.redirect(failurePath(returnTo));
  }
}

/** 提供本地 OAuth 登录入口、PKCE 回调及可用供应商列表。 */
export function oauthRoutes(
  auth: EnterpriseAuth | undefined,
  setSession: (c: Context, auth: EnterpriseAuth, result: AuthResult) => void,
) {
  const app = new Hono();
  const config = auth?.config.oauth;
  app.get("/providers", (c) =>
    c.json({
      providers: config?.providers ?? [],
      emailTurnstileSiteKey: config?.emailTurnstileSiteKey,
    }),
  );
  app.post("/start", async (c) => {
    if (!auth || !config)
      return c.json({ error: { code: "AUTH_NOT_CONFIGURED", message: "第三方登录暂未开放" } }, 503);
    const origin = c.req.header("Origin");
    if (!origin || !trustedAuthRequest(c, auth))
      return c.json({ error: { code: "UNTRUSTED_ORIGIN", message: "请求来源不受信任" } }, 403);
    const input = socialLoginInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success || !config.providers.includes(input.data.provider))
      return c.json({ error: { code: "VALIDATION_ERROR", message: "登录方式无效" } }, 400);
    const { provider } = input.data;
    const verifier = randomBytes(32).toString("base64url");
    const returnTo = safeReturnTo(input.data.returnTo);
    const flow = { provider, returnTo, verifier, expiresAt: Date.now() + flowDuration * 1000 };
    // OAuth 跨站返回时只携带短期流程 Cookie；主站会话仍使用原有策略。
    await setSignedCookie(c, flowCookie, JSON.stringify(flow), auth.config.secret, {
      path: cookiePath,
      httpOnly: true,
      secure: auth.config.secureCookie,
      sameSite: "Lax",
      maxAge: flowDuration,
    });
    return c.json({
      url: supabaseAuthorizeUrl(config, provider, `${origin}${cookiePath}/callback`, verifier),
    });
  });
  app.get("/callback", (c) => completeOAuth(c, auth, setSession));
  return app;
}

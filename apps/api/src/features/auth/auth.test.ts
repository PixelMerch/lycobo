import { enterpriseLoginResponseSchema, unwrapApiData } from "@lycoboai/contracts";
import type { AuthRepository } from "@lycoboai/db";
import { sign } from "hono/jwt";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createApp } from "../../app";
import { hashPassword, verifyPassword } from "./password";
import { verifyPasswordTurnstile } from "./password-turnstile";
import { enterpriseAuth, readAuthConfig } from "./service";

const origin = "http://localhost:5173";
const secret = "test-secret-".repeat(4);
const user = {
  userId: crypto.randomUUID(),
  organizationId: crypto.randomUUID(),
  role: "member" as const,
  account: "fixture-account",
};
async function fixture(email = false) {
  const credential = {
    id: crypto.randomUUID(),
    account: user.account,
    user_id: user.userId,
    organization_id: user.organizationId,
    password_hash: await hashPassword("fixture-password-123"),
  };
  let active = true;
  const repository: AuthRepository = {
    close: vi.fn(),
    allowLogin: vi.fn(async () => true),
    claimPasswordChallenge: vi.fn(async () => true),
    passwordLoginRetryAfter: vi.fn(async () => 0),
    recordPasswordFailure: vi.fn(async () => 0),
    allowEmailCode: vi.fn(async () => true),
    credential: vi.fn(async (account) => (account === user.account ? credential : null)),
    createSession: vi.fn(async () => true),
    createSocialSession: vi.fn(async () => true),
    identity: vi.fn(async () => (active ? user : null)),
    revoke: vi.fn(async () => {
      active = false;
    }),
    setCredential: vi.fn(),
    rotateRefresh: vi.fn(async () => null),
    changePassword: vi.fn(async () => true),
    setAvatarPreset: vi.fn(async () => true),
    setPreferredLocale: vi.fn(async () => true),
    setNickname: vi.fn(async () => true),
  };
  const oauth = {
    origin: "https://fixture.supabase.co",
    key: "fixture-key",
    providers: ["google" as const],
    emailTurnstileSiteKey: "fixture-sitekey",
  };
  const verifyChallenge = vi.fn(async (_secret: string, token: string) => token === "fixture-pass");
  const auth = enterpriseAuth(
    repository,
    {
      secret,
      origins: [origin],
      secureCookie: false,
      passwordTurnstile: { siteKey: "fixture-site-key", secret: "fixture-secret" },
      ...(email && { oauth }),
    },
    verifyChallenge,
  );
  return { auth, repository, verifyChallenge, app: createApp(undefined, undefined, auth) };
}
describe("enterprise JWT login", () => {
  it("hashes with a random salt, verifies exact passwords and rejects malformed hashes", async () => {
    const first = await hashPassword("correct-password");
    expect(first).not.toBe(await hashPassword("correct-password"));
    expect(await verifyPassword("correct-password", first)).toBe(true);
    expect(await verifyPassword("wrong-password", first)).toBe(false);
    expect(await verifyPassword("correct-password", "plain-text")).toBe(false);
  });
  it("requires a strong configured key and explicit trusted origins", () => {
    expect(readAuthConfig({})).toBeUndefined();
    expect(() => readAuthConfig({ AUTH_JWT_SECRET: "short" })).toThrow();
    expect(() => readAuthConfig({ AUTH_JWT_SECRET: secret })).toThrow();
    expect(() =>
      readAuthConfig({ AUTH_JWT_SECRET: secret, AUTH_TRUSTED_ORIGINS: origin }),
    ).toThrow();
    expect(
      readAuthConfig({
        AUTH_JWT_SECRET: secret,
        AUTH_TRUSTED_ORIGINS: "https://studio.example.com",
      })?.secureCookie,
    ).toBe(true);
  });
  it("只读取当前运行环境对应的第三方登录配置", () => {
    const env = {
      AUTH_JWT_SECRET: secret,
      AUTH_TRUSTED_ORIGINS: "https://studio.example.com",
      DEV_SUPABASE_AUTH_URL: "https://abcdefghijklmnopqrst.supabase.co",
      DEV_SUPABASE_AUTH_PUBLISHABLE_KEY: "sb_publishable_fixture",
      DEV_SUPABASE_AUTH_PROVIDERS: "google",
    };
    expect(readAuthConfig(env)?.oauth).toBeUndefined();
    expect(readAuthConfig({ ...env, NODE_ENV: "development" })?.oauth?.providers).toEqual([
      "google",
    ]);
    const production = readAuthConfig({
      ...env,
      SUPABASE_AUTH_URL: "https://abcdefghijklmnopqrst.supabase.co",
      SUPABASE_AUTH_PUBLISHABLE_KEY: "sb_publishable_fixture",
      SUPABASE_AUTH_PROVIDERS: "google,apple",
      SUPABASE_EMAIL_TURNSTILE_SITE_KEY: "fixture-site-key",
    });
    expect(production?.oauth?.providers).toEqual(["google", "apple"]);
    expect(production?.oauth?.emailTurnstileSiteKey).toBe("fixture-site-key");
  });
  it("does not enumerate accounts, rate limits and refuses hostile origins before checking credentials", async () => {
    const { app, repository } = await fixture();
    const request = (account: string, password: string, requestOrigin = origin) =>
      app.request("/api/v1/auth/enterprise/login", {
        method: "POST",
        headers: { Origin: requestOrigin, "Content-Type": "application/json" },
        body: JSON.stringify({ account, password, captchaToken: "fixture-pass" }),
      });
    expect((await request(user.account, "bad", "https://hostile.example")).status).toBe(403);
    expect(repository.credential).not.toHaveBeenCalled();
    const wrong = await request(user.account, "bad");
    const missing = await request("does-not-exist", "bad");
    expect(wrong.status).toBe(401);
    const errorSchema = z.object({ message: z.string() });
    expect(errorSchema.parse(await wrong.json()).message).toBe(
      errorSchema.parse(await missing.json()).message,
    );
    vi.mocked(repository.allowLogin).mockResolvedValue(false);
    const limited = await request(user.account, "fixture-password-123");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
  });
  it("requires verification before checking passwords and reports the current lock", async () => {
    const { app, repository, verifyChallenge } = await fixture();
    const request = (captchaToken?: string) =>
      app.request("/api/v1/auth/enterprise/login", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ account: user.account, password: "bad", captchaToken }),
      });
    expect((await request()).status).toBe(400);
    expect(verifyChallenge).not.toHaveBeenCalled();
    expect((await request("invalid")).status).toBe(403);
    expect(repository.credential).not.toHaveBeenCalled();
    expect(repository.recordPasswordFailure).not.toHaveBeenCalled();
    vi.mocked(repository.recordPasswordFailure).mockResolvedValueOnce(3600);
    const locked = await request("fixture-pass");
    expect(locked.status).toBe(429);
    expect(locked.headers.get("Retry-After")).toBe("3600");
    expect(await locked.json()).toMatchObject({ error: { code: "ACCOUNT_LOCKED" } });
    vi.mocked(repository.passwordLoginRetryAfter).mockResolvedValueOnce(3500);
    expect((await request("fixture-pass")).headers.get("Retry-After")).toBe("3500");
    expect(repository.recordPasswordFailure).toHaveBeenCalledTimes(1);
    expect(repository.createSession).not.toHaveBeenCalled();
  });
  it("accepts Siteverify success only for the login action and the trusted hostname", async () => {
    const fetchSiteverify = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchSiteverify);
    try {
      fetchSiteverify
        .mockResolvedValueOnce(
          Response.json({ success: true, action: "email_login", hostname: "localhost" }),
        )
        .mockResolvedValueOnce(
          Response.json({ success: true, action: "password_login", hostname: "elsewhere.example" }),
        )
        .mockResolvedValueOnce(
          Response.json({ success: true, action: "password_login", hostname: "localhost" }),
        )
        .mockResolvedValueOnce(
          Response.json({ success: false, "error-codes": ["timeout-or-duplicate"] }),
        )
        .mockRejectedValue(new Error("fixture timeout"));
      const verify = () => verifyPasswordTurnstile("fixture-secret", "fixture-token", origin);
      expect(await verify()).toBe(false);
      expect(await verify()).toBe(false);
      expect(await verify()).toBe(true);
      expect(await verify()).toBe(false);
      expect(await verify()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("retries a transient Siteverify failure with the same verification key", async () => {
    const fetchSiteverify = vi.fn<typeof fetch>();
    fetchSiteverify
      .mockResolvedValueOnce(Response.json({ success: false, "error-codes": ["internal-error"] }))
      .mockResolvedValueOnce(
        Response.json({ success: true, action: "password_login", hostname: "localhost" }),
      );
    vi.stubGlobal("fetch", fetchSiteverify);
    try {
      expect(await verifyPasswordTurnstile("fixture-secret", "fixture-token", origin)).toBe(true);
      expect(fetchSiteverify).toHaveBeenCalledTimes(2);
      const [first, second] = fetchSiteverify.mock.calls.map(([, options]) => options?.body);
      expect(first).toBeInstanceOf(URLSearchParams);
      expect(first).toBe(second);
      expect(new URLSearchParams(String(first)).get("idempotency_key")).toMatch(/^[\da-f-]{36}$/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("saves only a supported locale for the authenticated user", async () => {
    const { app, auth, repository } = await fixture();
    const login = await auth.login(user.account, "fixture-password-123");
    if ("error" in login) throw new Error("fixture login failed");
    const put = (body: unknown, headers: Record<string, string>) =>
      app.request("/api/v1/auth/locale", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
    const bearer = { Authorization: `Bearer ${login.accessToken}` };
    expect((await put({ preferredLocale: "en" }, {})).status).toBe(401);
    expect((await put({ preferredLocale: "fr" }, bearer)).status).toBe(400);
    expect((await put({ preferredLocale: "en", userId: crypto.randomUUID() }, bearer)).status).toBe(
      400,
    );
    expect(
      (
        await put(
          { preferredLocale: "en" },
          {
            Cookie: `lycobo_enterprise_session=${login.accessToken}`,
            Origin: "https://hostile.example",
          },
        )
      ).status,
    ).toBe(401);
    const result = await put({ preferredLocale: "en" }, bearer);
    expect(result.status).toBe(200);
    expect(unwrapApiData(await result.json())).toMatchObject({
      userId: user.userId,
      preferredLocale: "en",
    });
    expect(repository.setPreferredLocale).toHaveBeenCalledExactlyOnceWith(user.userId, "en");
  });
  it("saves a preset avatar only for the session user and rejects unknown presets or hostile origins", async () => {
    const { app, auth, repository } = await fixture();
    const login = await auth.login(user.account, "fixture-password-123");
    if ("error" in login) throw new Error("fixture login failed");
    const put = (body: unknown, headers: Record<string, string>) =>
      app.request("/api/v1/auth/avatar", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
    const bearer = { Authorization: `Bearer ${login.accessToken}` };
    expect((await put({ avatarPreset: "sky" }, {})).status).toBe(401);
    expect((await put({ avatarPreset: "glitter" }, bearer)).status).toBe(400);
    // 请求体不能指定别人的 userId：严格校验拒绝多余字段。
    expect((await put({ avatarPreset: "sky", userId: crypto.randomUUID() }, bearer)).status).toBe(
      400,
    );
    const saved = await put({ avatarPreset: "sky" }, bearer);
    expect(saved.status).toBe(200);
    expect(unwrapApiData(await saved.json())).toMatchObject({ avatarPreset: "sky" });
    expect(repository.setAvatarPreset).toHaveBeenCalledWith(user.userId, "sky");
    // Cookie 登录的写请求来自不可信来源时不能改头像。
    const hostile = await put(
      { avatarPreset: "rose" },
      {
        Cookie: `lycobo_enterprise_session=${login.accessToken}`,
        Origin: "https://hostile.example",
      },
    );
    expect(hostile.status).toBe(401);
    expect(repository.setAvatarPreset).toHaveBeenCalledTimes(1);
    expect((await put({ avatarPreset: null }, bearer)).status).toBe(200);
    expect(repository.setAvatarPreset).toHaveBeenLastCalledWith(user.userId, null);
  });
  it("sets an HttpOnly JWT cookie, accepts Bearer, rejects tampering and revokes logout", async () => {
    const { app } = await fixture();
    const response = await app.request("/api/v1/auth/enterprise/login", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        account: user.account.toUpperCase(),
        password: "fixture-password-123",
        captchaToken: "fixture-pass",
      }),
    });
    expect(response.status).toBe(200);
    const capabilities = await app.request("/api/v1/system/capabilities");
    expect(unwrapApiData(await capabilities.json())).toMatchObject({
      authenticationEnabled: false,
      enterprisePasswordLoginEnabled: true,
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    const { accessToken, expiresIn, refreshExpiresIn } = enterpriseLoginResponseSchema.parse(
      unwrapApiData(await response.json()),
    );
    expect(accessToken.split(".")).toHaveLength(3);
    expect(expiresIn).toBe(86400);
    expect(refreshExpiresIn).toBeGreaterThan(2591995);
    expect(
      response.headers
        .getSetCookie()
        .find((value) => value.startsWith("lycobo_enterprise_refresh=")),
    ).toContain("Path=/api/v1/auth");
    expect(
      (
        await app.request("/api/v1/auth/session", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request("/api/v1/auth/session", {
          headers: { Authorization: `Bearer ${accessToken}corrupt` },
        })
      ).status,
    ).toBe(401);
    expect(
      (await app.request("/api/v1/auth/logout", { method: "POST", headers: { Cookie: cookie } }))
        .status,
    ).toBe(403);
    expect(
      (
        await app.request("/api/v1/auth/logout", {
          method: "POST",
          headers: { Origin: origin, Cookie: cookie },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request("/api/v1/auth/session", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
      ).status,
    ).toBe(401);
  });
  it("expires access after one day and can issue a replacement inside the fixed refresh lifetime", async () => {
    const { auth, repository } = await fixture();
    const login = await auth.login(user.account, "fixture-password-123");
    if ("error" in login) throw new Error("Fixture login failed");
    const created = vi.mocked(repository.createSession).mock.calls[0];
    expect(created?.[3]).toMatch(/^[a-f0-9]{64}$/);
    expect(created?.[3]).not.toBe(login.refreshToken);
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now + 86401 * 1000);
    try {
      expect(await auth.authenticate(login.accessToken)).toBeNull();
      vi.mocked(repository.rotateRefresh).mockResolvedValue({
        id: created?.[0] ?? crypto.randomUUID(),
        expires_at: new Date(now + 2592000 * 1000),
      });
      const refreshed = await auth.refresh(login.refreshToken);
      expect(refreshed?.expiresIn).toBe(86400);
      expect(refreshed?.refreshExpiresIn).toBeLessThan(2592000);
      expect(refreshed?.refreshToken).not.toBe(login.refreshToken);
      expect(await auth.authenticate(refreshed?.accessToken ?? "")).not.toBeNull();
    } finally {
      clock.mockRestore();
    }
  });
  it("rejects expired tokens, wrong audience/issuer/purpose and identity substitutions", async () => {
    const { auth } = await fixture();
    const now = Math.floor(Date.now() / 1000);
    const valid = {
      sub: user.userId,
      org: user.organizationId,
      jti: crypto.randomUUID(),
      iat: now,
      exp: now + 900,
      iss: "lycoboai-api",
      aud: "lycoboai-web",
      purpose: "enterprise-access",
    };
    for (const patch of [
      { exp: now - 1 },
      { exp: now + 86401 },
      { aud: "other" },
      { iss: "other" },
      { purpose: "refresh" },
      { org: crypto.randomUUID() },
      { sub: crypto.randomUUID() },
      { iat: now + 10 },
    ]) {
      expect(
        await auth.authenticate(await sign({ ...valid, ...patch }, secret, "HS256")),
      ).toBeNull();
    }
  });
});

describe("第三方登录工作区回跳", () => {
  it.each([
    [
      "/zh-CN/dashboard/commerce/create?task=fixture#result",
      "/zh-CN/dashboard/commerce/create?task=fixture#result",
    ],
    ["/en/dashboard", "/en/dashboard"],
    ["/zh-CN/recharge?source=footer#packs", "/en"],
    ["/zh-CN/membership", "/en"],
    ["/en/dashboard/login", "/en"],
    ["//external.example/en/dashboard", "/en"],
  ])("只保留受支持的目标 %s", async (returnTo, expected) => {
    const { app } = await fixture(true);
    const start = await app.request("/api/v1/auth/oauth/start", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "google", returnTo }),
    });
    expect(start.status).toBe(200);
    const cookie = start.headers.getSetCookie()[0]?.split(";", 1)[0] ?? "";
    // 不提供供应商授权码，检查签名流程保留的返回地址，不调用外部服务。
    const callback = await app.request("/api/v1/auth/oauth/callback", {
      headers: { Cookie: cookie },
    });
    expect(callback.status).toBe(302);
    const location = new URL(callback.headers.get("Location") ?? "", origin);
    expect(location.searchParams.get("returnTo")).toBe(expected);
    expect(location.searchParams.get("oauth")).toBe("failed");
  });
});

describe("邮箱验证码登录", () => {
  afterEach(() => vi.unstubAllGlobals());

  function request(app: Awaited<ReturnType<typeof fixture>>["app"], path: string, body: object) {
    return app.request(`/api/v1/auth/email/${path}`, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("要求验证码发送令牌，并在限流或验证失败时拒绝", async () => {
    const { app, repository } = await fixture(true);
    const fetchProvider = vi.fn(async () =>
      Response.json({ error_code: "captcha_failed" }, { status: 400 }),
    );
    vi.stubGlobal("fetch", fetchProvider);
    const email = " TEST@example.com ";
    expect((await request(app, "send", { email })).status).toBe(400);
    expect(fetchProvider).not.toHaveBeenCalled();
    expect((await request(app, "send", { email, captchaToken: "invalid" })).status).toBe(400);
    expect(repository.allowEmailCode).toHaveBeenCalledWith("test@example.com", "local", "send");
    expect(fetchProvider).toHaveBeenCalledWith(
      new URL("https://fixture.supabase.co/auth/v1/otp"),
      expect.objectContaining({
        redirect: "manual",
        body: JSON.stringify({
          email: "test@example.com",
          create_user: true,
          gotrue_meta_security: { captcha_token: "invalid" },
        }),
      }),
    );
    vi.mocked(repository.allowEmailCode).mockResolvedValue(false);
    expect((await request(app, "send", { email, captchaToken: "another" })).status).toBe(429);
    expect(fetchProvider).toHaveBeenCalledTimes(1);
  });

  it("只为 Supabase 验证过的邮箱签发站内会话", async () => {
    const { app, repository } = await fixture(true);
    const id = crypto.randomUUID();
    const fetchProvider = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ error_code: "otp_expired" }, { status: 403 }))
      .mockResolvedValueOnce(Response.json({ user: { id, email: "test@example.com" } }));
    vi.stubGlobal("fetch", fetchProvider);
    const body = { email: "test@example.com", code: "012345" };
    expect((await request(app, "verify", body)).status).toBe(401);
    expect(repository.createSocialSession).not.toHaveBeenCalled();
    const login = await request(app, "verify", body);
    expect(login.status).toBe(200);
    expect(login.headers.getSetCookie().join(" ")).toContain("HttpOnly");
    expect(repository.createSocialSession).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: id, email: body.email }),
    );
  });
});

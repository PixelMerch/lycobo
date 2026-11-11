import { enterpriseLoginResponseSchema, unwrapApiData } from "@lycoboai/contracts";
import type { AuthRepository } from "@lycoboai/db";
import { sign } from "hono/jwt";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createApp } from "../../app";
import { hashPassword, verifyPassword } from "./password";
import { enterpriseAuth, readAuthConfig } from "./service";

const origin = "http://localhost:5173";
const secret = "test-secret-".repeat(4);
const user = {
  userId: crypto.randomUUID(),
  organizationId: crypto.randomUUID(),
  role: "member" as const,
  account: "fixture-account",
};
async function fixture() {
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
  };
  const auth = enterpriseAuth(repository, { secret, origins: [origin], secureCookie: false });
  return { auth, repository, app: createApp(undefined, undefined, auth) };
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
  it("does not enumerate accounts, rate limits and refuses hostile origins before checking credentials", async () => {
    const { app, repository } = await fixture();
    const request = (account: string, password: string, requestOrigin = origin) =>
      app.request("/api/v1/auth/enterprise/login", {
        method: "POST",
        headers: { Origin: requestOrigin, "Content-Type": "application/json" },
        body: JSON.stringify({ account, password }),
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
    expect(limited.headers.get("retry-after")).toBe("900");
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

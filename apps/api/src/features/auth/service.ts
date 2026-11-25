import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { AccountLocale } from "@lycoboai/contracts";
import type { AuthRepository } from "@lycoboai/db";
import { sign, verify } from "hono/jwt";
import { z } from "zod";
import { dummyPasswordHash, hashPassword, verifyPassword } from "./password";
import { verifyPasswordTurnstile } from "./password-turnstile";
import { readSupabaseOAuth, type SupabaseOAuthConfig } from "./supabase-oauth";

export type AuthConfig = {
  secret: string;
  origins: string[];
  secureCookie: boolean;
  oauth?: SupabaseOAuthConfig;
  passwordTurnstile?: { siteKey: string; secret: string };
  edgeClientAddress?: string | null;
};
/** 读取主站 JWT、可信来源、密码登录验证及第三方登录配置。 */
export function readAuthConfig(env: Record<string, string | undefined>): AuthConfig | undefined {
  if (!env.AUTH_JWT_SECRET) return undefined;
  if (Buffer.byteLength(env.AUTH_JWT_SECRET) < 32)
    throw new Error("AUTH_JWT_SECRET requires at least 32 bytes");
  const origins = (env.AUTH_TRUSTED_ORIGINS ?? "").split(",").filter(Boolean);
  if (!origins.length) throw new Error("AUTH_TRUSTED_ORIGINS is required");
  for (const origin of origins) {
    const url = new URL(origin);
    if (
      url.origin !== origin ||
      !(
        url.protocol === "https:" ||
        (env.NODE_ENV === "development" &&
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
      )
    )
      throw new Error("Invalid auth origin; production requires HTTPS");
  }
  const secureCookie =
    env.NODE_ENV !== "development" || origins.some((origin) => origin.startsWith("https:"));
  const oauth = readSupabaseOAuth(env);
  const prefix = env.NODE_ENV === "development" ? "DEV_" : "";
  const siteKey = env[`${prefix}AUTH_PASSWORD_TURNSTILE_SITE_KEY`]?.trim();
  const secret = env[`${prefix}AUTH_PASSWORD_TURNSTILE_SECRET`]?.trim();
  return {
    secret: env.AUTH_JWT_SECRET,
    origins,
    secureCookie,
    ...(oauth && { oauth }),
    ...(siteKey && secret && { passwordTurnstile: { siteKey, secret } }),
  };
}
const claimsSchema = z.object({
  sub: z.uuid(),
  org: z.uuid(),
  jti: z.uuid(),
  iat: z.number().int(),
  exp: z.number().int(),
  iss: z.literal("lycoboai-api"),
  aud: z.literal("lycoboai-web"),
  purpose: z.literal("enterprise-access"),
});
export const accessTokenLifetime = 24 * 60 * 60;
export const refreshTokenLifetime = 30 * 24 * 60 * 60;
const refreshHash = (token: string) => createHash("sha256").update(token).digest("hex");
const refreshClaimsSchema = claimsSchema
  .pick({ jti: true, iat: true, exp: true, iss: true, aud: true })
  .extend({
    purpose: z.literal("enterprise-refresh"),
    nonce: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  });
async function readRefreshClaims(token: string, secret: string) {
  if (token.length > 2048) return null;
  try {
    const claims = refreshClaimsSchema.parse(await verify(token, secret, "HS256"));
    const now = Math.floor(Date.now() / 1000);
    return claims.iat <= now && claims.exp > now && claims.exp - claims.iat <= refreshTokenLifetime
      ? claims
      : null;
  } catch {
    return null;
  }
}

type LoginPersistence = (id: string, expiresAt: Date, hash: string) => Promise<boolean>;

async function verifyChallenge(
  repository: AuthRepository,
  config: AuthConfig,
  verifyToken: typeof verifyPasswordTurnstile,
  token: string,
  origin: string,
) {
  if (!config.passwordTurnstile) return false;
  const verified = await verifyToken(
    config.passwordTurnstile.secret,
    token,
    origin,
    config.edgeClientAddress,
  );
  return verified && repository.claimPasswordChallenge(token);
}

async function loginWithPassword<T>(
  repository: AuthRepository,
  mintSession: (persist: LoginPersistence) => Promise<T | null>,
  account: string,
  password: string,
) {
  if (!(await repository.allowLogin())) return { error: "RATE_LIMITED" } as const;
  const credentialFailure = (retryAfter: number) =>
    retryAfter
      ? ({ error: "ACCOUNT_LOCKED", retryAfter } as const)
      : ({ error: "INVALID_CREDENTIALS" } as const);
  const retryAfter = await repository.passwordLoginRetryAfter(account);
  if (retryAfter) return credentialFailure(retryAfter);
  const credential = await repository.credential(account);
  const valid = await verifyPassword(password, credential?.password_hash ?? dummyPasswordHash);
  // 未知账号也执行相同的失败和锁定流程，避免通过响应推断账号是否存在。
  if (!credential || !valid)
    return credentialFailure(await repository.recordPasswordFailure(account));
  const session = await mintSession((id, expiresAt, hash) =>
    repository.createSession(id, credential, expiresAt, hash),
  );
  return session ?? credentialFailure(await repository.passwordLoginRetryAfter(account));
}

/** 企业账号鉴权服务：签发与校验 JWT、刷新、改密、保存个人偏好与撤销会话。 */
export function enterpriseAuth(
  repository: AuthRepository,
  config: AuthConfig,
  verifyLoginToken = verifyPasswordTurnstile,
) {
  const mintRefresh = (sessionId: string, expiresAt: Date) =>
    sign(
      {
        jti: sessionId,
        nonce: randomBytes(32).toString("base64url"),
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(expiresAt.getTime() / 1000),
        iss: "lycoboai-api",
        aud: "lycoboai-web",
        purpose: "enterprise-refresh",
      },
      config.secret,
      "HS256",
    );
  const issue = async (sessionId: string, refreshToken: string, expiresAt: Date) => {
    const user = await repository.identity(sessionId);
    if (!user) return null;
    const now = Math.floor(Date.now() / 1000);
    const refreshExpiresIn = Math.floor(expiresAt.getTime() / 1000) - now;
    if (refreshExpiresIn <= 0) return null;
    const expiresIn = Math.min(accessTokenLifetime, refreshExpiresIn);
    const accessToken = await sign(
      {
        sub: user.userId,
        org: user.organizationId,
        jti: sessionId,
        iat: now,
        exp: now + expiresIn,
        iss: "lycoboai-api",
        aud: "lycoboai-web",
        purpose: "enterprise-access",
      },
      config.secret,
      "HS256",
    );
    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn,
      refreshExpiresIn,
      user,
    } as const;
  };
  async function createLoginSession(persist: LoginPersistence) {
    const id = randomUUID();
    const expiresAt = new Date((Math.floor(Date.now() / 1000) + refreshTokenLifetime) * 1000);
    const refreshToken = await mintRefresh(id, expiresAt);
    if (!(await persist(id, expiresAt, refreshHash(refreshToken)))) return null;
    const result = await issue(id, refreshToken, expiresAt);
    if (!result) await repository.revoke(id);
    return result;
  }
  return {
    config,
    verifyLoginChallenge: (token: string, origin: string) =>
      verifyChallenge(repository, config, verifyLoginToken, token, origin),
    login: (account: string, password: string) =>
      loginWithPassword(repository, createLoginSession, account, password),
    /** 复用主站会话签发，不将 Supabase 的访问或刷新凭据写入浏览器。 */
    socialLogin: (identity: { externalId: string; email: string | null; nickname?: string }) =>
      createLoginSession((sessionId, expiresAt, refreshHash) =>
        repository.createSocialSession({ ...identity, sessionId, expiresAt, refreshHash }),
      ),
    /** 为邮箱验证码发送和校验分别应用来源及邮箱配额。 */
    allowEmailCode: (email: string, address: string, action: "send" | "verify") =>
      repository.allowEmailCode(email, address, action),
    async refresh(token: string) {
      const claims = await readRefreshClaims(token, config.secret);
      if (!claims) return null;
      const nextToken = await mintRefresh(claims.jti, new Date(claims.exp * 1000));
      const session = await repository.rotateRefresh(refreshHash(token), refreshHash(nextToken));
      return session ? issue(session.id, nextToken, session.expires_at) : null;
    },
    async authenticate(token: string) {
      let claims: z.infer<typeof claimsSchema>;
      try {
        claims = claimsSchema.parse(await verify(token, config.secret, "HS256"));
      } catch {
        return null;
      }
      const now = Math.floor(Date.now() / 1000);
      if (claims.exp <= now || claims.iat > now || claims.exp - claims.iat > accessTokenLifetime)
        return null;
      const user = await repository.identity(claims.jti);
      if (!user || user.userId !== claims.sub || user.organizationId !== claims.org) return null;
      return { user, sessionId: claims.jti, expiresAt: claims.exp };
    },
    async changePassword(account: string, currentPassword: string, newPassword: string) {
      if (!(await repository.allowLogin(`password:${account}`))) return false;
      const credential = await repository.credential(account);
      if (!credential || !(await verifyPassword(currentPassword, credential.password_hash)))
        return false;
      return repository.changePassword(credential, await hashPassword(newPassword));
    },
    /** 保存当前用户的预设头像；id 已由路由按契约校验。 */
    setAvatarPreset: (userId: string, avatarPreset: string | null) =>
      repository.setAvatarPreset(userId, avatarPreset),
    /** 保存当前会话用户的昵称。 */
    setNickname: (userId: string, nickname: string) => repository.setNickname(userId, nickname),
    /** 保存由会话确定的用户的界面语言。 */
    setPreferredLocale: (userId: string, locale: AccountLocale) =>
      repository.setPreferredLocale(userId, locale),
    async revokeRefresh(token: string) {
      // 刚轮换的凭据在退出时仍可撤销自己的会话，但永远不会再被接受用于续期，避免退出与刷新的竞争。
      const claims = await readRefreshClaims(token, config.secret);
      if (claims) await repository.revoke(claims.jti);
    },
    revoke: (id: string) => repository.revoke(id),
  };
}
export type EnterpriseAuth = ReturnType<typeof enterpriseAuth>;

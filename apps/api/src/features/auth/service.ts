import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { AuthRepository } from "@lycoboai/db";
import { sign, verify } from "hono/jwt";
import { z } from "zod";
import { dummyPasswordHash, hashPassword, verifyPassword } from "./password";

export type AuthConfig = { secret: string; origins: string[]; secureCookie: boolean };
export function readAuthConfig(env: NodeJS.ProcessEnv): AuthConfig | undefined {
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
  return { secret: env.AUTH_JWT_SECRET, origins, secureCookie };
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
// A valid session is re-checked against the database at most every 30 seconds per API instance:
// logout, revocation and password changes evict it here at once, and take effect on other
// instances within that window. Login and refresh always read the database.
const identityTtlMs = 30000;
export function enterpriseAuth(repository: AuthRepository, config: AuthConfig) {
  const identities = new Map<
    string,
    { user: NonNullable<Awaited<ReturnType<AuthRepository["identity"]>>>; until: number }
  >();
  const currentIdentity = async (sessionId: string) => {
    const cached = identities.get(sessionId);
    if (cached && cached.until > Date.now()) return cached.user;
    const user = await repository.identity(sessionId);
    if (!user) identities.delete(sessionId);
    else {
      if (identities.size >= 5000) identities.clear();
      identities.set(sessionId, { user, until: Date.now() + identityTtlMs });
    }
    return user;
  };
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
  const refreshClaims = async (token: string) => {
    if (token.length > 2048) return null;
    try {
      const claims = refreshClaimsSchema.parse(await verify(token, config.secret, "HS256"));
      const now = Math.floor(Date.now() / 1000);
      return claims.iat <= now &&
        claims.exp > now &&
        claims.exp - claims.iat <= refreshTokenLifetime
        ? claims
        : null;
    } catch {
      return null;
    }
  };
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
  return {
    config,
    async login(account: string, password: string) {
      if (!(await repository.allowLogin(account))) return { error: "RATE_LIMITED" } as const;
      const credential = await repository.credential(account);
      const valid = await verifyPassword(password, credential?.password_hash ?? dummyPasswordHash);
      if (!credential || !valid) return { error: "INVALID_CREDENTIALS" } as const;
      const jti = randomUUID();
      const expiresAt = new Date((Math.floor(Date.now() / 1000) + refreshTokenLifetime) * 1000);
      const refreshToken = await mintRefresh(jti, expiresAt);
      if (!(await repository.createSession(jti, credential, expiresAt, refreshHash(refreshToken))))
        return { error: "INVALID_CREDENTIALS" } as const;
      const result = await issue(jti, refreshToken, expiresAt);
      if (!result) {
        await repository.revoke(jti);
        return { error: "INVALID_CREDENTIALS" } as const;
      }
      return result;
    },
    async refresh(token: string) {
      const claims = await refreshClaims(token);
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
      const user = await currentIdentity(claims.jti);
      if (!user || user.userId !== claims.sub || user.organizationId !== claims.org) return null;
      return { user, sessionId: claims.jti, expiresAt: claims.exp };
    },
    async changePassword(account: string, currentPassword: string, newPassword: string) {
      if (!(await repository.allowLogin(`password:${account}`))) return false;
      const credential = await repository.credential(account);
      if (!credential || !(await verifyPassword(currentPassword, credential.password_hash)))
        return false;
      const changed = await repository.changePassword(credential, await hashPassword(newPassword));
      // The change revokes the account's sessions; stop trusting any cached one here.
      identities.clear();
      return changed;
    },
    async revokeRefresh(token: string) {
      // Just-rotated credentials may still revoke their own session during logout,
      // but are never accepted for renewal. This closes the logout/refresh race.
      const claims = await refreshClaims(token);
      if (claims) {
        identities.delete(claims.jti);
        await repository.revoke(claims.jti);
      }
    },
    revoke: async (id: string) => {
      identities.delete(id);
      await repository.revoke(id);
    },
  };
}
export type EnterpriseAuth = ReturnType<typeof enterpriseAuth>;

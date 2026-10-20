import { randomUUID } from "node:crypto";
import type { AuthRepository } from "@lycoboai/db";
import { sign, verify } from "hono/jwt";
import { z } from "zod";
import { dummyPasswordHash, verifyPassword } from "./password";

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
export function enterpriseAuth(repository: AuthRepository, config: AuthConfig) {
  const expiresIn = 900;
  return {
    config,
    async login(account: string, password: string) {
      if (!(await repository.allowLogin(account))) return { error: "RATE_LIMITED" } as const;
      const credential = await repository.credential(account);
      const valid = await verifyPassword(password, credential?.password_hash ?? dummyPasswordHash);
      if (!credential || !valid) return { error: "INVALID_CREDENTIALS" } as const;
      const jti = randomUUID();
      const now = Math.floor(Date.now() / 1000);
      const accessToken = await sign(
        {
          sub: credential.user_id,
          org: credential.organization_id,
          jti,
          iat: now,
          exp: now + expiresIn,
          iss: "lycoboai-api",
          aud: "lycoboai-web",
          purpose: "enterprise-access",
        },
        config.secret,
        "HS256",
      );
      if (!(await repository.createSession(jti, credential, new Date((now + expiresIn) * 1000))))
        return { error: "INVALID_CREDENTIALS" } as const;
      const user = await repository.identity(jti);
      if (!user) {
        await repository.revoke(jti);
        return { error: "INVALID_CREDENTIALS" } as const;
      }
      return { accessToken, tokenType: "Bearer", expiresIn, user } as const;
    },
    async authenticate(token: string) {
      let claims: z.infer<typeof claimsSchema>;
      try {
        claims = claimsSchema.parse(await verify(token, config.secret, "HS256"));
      } catch {
        return null;
      }
      const now = Math.floor(Date.now() / 1000);
      if (claims.exp <= now || claims.iat > now || claims.exp - claims.iat > expiresIn) return null;
      const user = await repository.identity(claims.jti);
      if (!user || user.userId !== claims.sub || user.organizationId !== claims.org) return null;
      return { user, sessionId: claims.jti };
    },
    revoke: (id: string) => repository.revoke(id),
  };
}
export type EnterpriseAuth = ReturnType<typeof enterpriseAuth>;

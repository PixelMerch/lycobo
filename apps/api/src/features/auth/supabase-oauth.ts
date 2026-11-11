import { createHash } from "node:crypto";
import { type SocialProvider, socialProviders } from "@lycoboai/contracts";
import { z } from "zod";

const userResponse = z.object({
  user: z.object({
    id: z.uuid(),
    email: z.email().max(320).optional(),
    identities: z.array(z.object({ provider: z.string() })),
  }),
});

/** 第三方认证项目与已配置的登录方式。 */
export type SupabaseOAuthConfig = {
  origin: string;
  key: string;
  providers: SocialProvider[];
  emailTurnstileSiteKey?: string;
};

/** 只在本地显式配置 OAuth，避免发布旧代码时意外开放第三方登录。 */
export function readSupabaseOAuth(
  env: Record<string, string | undefined>,
): SupabaseOAuthConfig | undefined {
  const providers = socialProviders.filter((provider) =>
    env.DEV_SUPABASE_AUTH_PROVIDERS?.split(",").includes(provider),
  );
  const emailTurnstileSiteKey = env.DEV_SUPABASE_EMAIL_TURNSTILE_SITE_KEY?.trim();
  if (env.NODE_ENV !== "development" || (!providers.length && !emailTurnstileSiteKey))
    return undefined;
  const url = new URL(env.DEV_SUPABASE_AUTH_URL ?? "");
  const key = env.DEV_SUPABASE_AUTH_PUBLISHABLE_KEY ?? "";
  if (
    url.protocol !== "https:" ||
    !/^[a-z]{20}\.supabase\.co$/.test(url.hostname) ||
    url.href !== `${url.origin}/` ||
    !/^sb_publishable_[\w-]+$/.test(key)
  )
    throw new Error("SUPABASE_OAUTH_CONFIG_INVALID");
  return {
    origin: url.origin,
    key,
    providers,
    ...(emailTurnstileSiteKey && { emailTurnstileSiteKey }),
  };
}

/** 使用 S256 将授权码绑定到本次浏览器发起的登录。 */
export function supabaseAuthorizeUrl(
  config: SupabaseOAuthConfig,
  provider: SocialProvider,
  callback: string,
  verifier: string,
) {
  const url = new URL("/auth/v1/authorize", config.origin);
  url.search = new URLSearchParams({
    provider,
    redirect_to: callback,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "s256",
  }).toString();
  return url.href;
}

/** 仅使用 Supabase 服务端交换结果确认外部身份，避免信任浏览器提供的账号。 */
export async function exchangeSupabaseCode(
  config: SupabaseOAuthConfig,
  provider: SocialProvider,
  code: string,
  verifier: string,
) {
  const response = await fetch(new URL("/auth/v1/token?grant_type=pkce", config.origin), {
    method: "POST",
    headers: { apikey: config.key, "Content-Type": "application/json" },
    body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return null;
  const data = userResponse.safeParse(await response.json());
  if (
    !data.success ||
    !data.data.user.identities.some((identity) => identity.provider === provider)
  )
    return null;
  return { externalId: data.data.user.id, email: data.data.user.email ?? null };
}

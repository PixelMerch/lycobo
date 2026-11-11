import { createHash } from "node:crypto";
import { type SocialProvider, socialProviders, userNicknameSchema } from "@lycoboai/contracts";
import { z } from "zod";

const userResponse = z.object({
  user: z.object({
    id: z.uuid(),
    email: z.email().max(320).optional(),
    identities: z.array(z.object({ provider: z.string(), identity_data: z.unknown().optional() })),
    user_metadata: z.unknown().optional(),
  }),
});

/** 第三方认证项目与已配置的登录方式。 */
export type SupabaseOAuthConfig = {
  origin: string;
  key: string;
  providers: SocialProvider[];
  emailTurnstileSiteKey?: string;
};

const profileName = z.object({ full_name: z.unknown().optional(), name: z.unknown().optional() });

function nicknameFrom(metadata: unknown) {
  const profile = profileName.safeParse(metadata);
  if (!profile.success) return undefined;
  return (
    userNicknameSchema.safeParse(profile.data.full_name).data ??
    userNicknameSchema.safeParse(profile.data.name).data
  );
}

/** 按环境读取独立配置，缺少生产绑定时保持第三方入口关闭。 */
export function readSupabaseOAuth(
  env: Record<string, string | undefined>,
): SupabaseOAuthConfig | undefined {
  const prefix = env.NODE_ENV === "development" ? "DEV_" : "";
  const key = env[`${prefix}SUPABASE_AUTH_PUBLISHABLE_KEY`]?.trim();
  if (!key) return undefined;
  const enabled = env[`${prefix}SUPABASE_AUTH_PROVIDERS`]?.split(",").map((value) => value.trim());
  const providers = socialProviders.filter((provider) => enabled?.includes(provider));
  const emailTurnstileSiteKey = env[`${prefix}SUPABASE_EMAIL_TURNSTILE_SITE_KEY`]?.trim();
  if (!providers.length && !emailTurnstileSiteKey) return undefined;
  const url = new URL(env[`${prefix}SUPABASE_AUTH_URL`] ?? "");
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
    // Workers 仅支持手动拒绝重定向，避免把认证数据转发到其他地址。
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return null;
  const data = userResponse.safeParse(await response.json());
  if (!data.success) return null;
  const { user } = data.data;
  const identity = user.identities.find((item) => item.provider === provider);
  if (!identity) return null;
  // Apple 网页 OAuth 常常没有姓名，只有当前身份确实提供时才自动填入。
  const nickname =
    nicknameFrom(identity.identity_data) ??
    (provider === "google" ? nicknameFrom(user.user_metadata) : undefined);
  return { externalId: user.id, email: user.email ?? null, ...(nickname && { nickname }) };
}

import { z } from "zod";
import type { SupabaseOAuthConfig } from "./supabase-oauth";

const verifiedUser = z.object({ user: z.object({ id: z.uuid(), email: z.email() }) });
const providerError = z.object({ error_code: z.string() });

async function authPost(config: SupabaseOAuthConfig, path: string, input: object) {
  return fetch(new URL(`/auth/v1/${path}`, config.origin), {
    method: "POST",
    headers: { apikey: config.key, "Content-Type": "application/json" },
    body: JSON.stringify(input),
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
}

/** 由 Supabase 向 Cloudflare 验证一次性令牌，通过后才经 SMTP 发码。 */
export async function sendSupabaseEmailCode(
  config: SupabaseOAuthConfig,
  email: string,
  captchaToken: string,
) {
  const response = await authPost(config, "otp", {
    email,
    create_user: true,
    gotrue_meta_security: { captcha_token: captchaToken },
  });
  if (response?.ok) return "sent";
  if (response?.status === 429) return "limited";
  const result = providerError.safeParse(await response?.json().catch(() => null));
  return result.data?.error_code === "captcha_failed" ? "captcha" : "unavailable";
}

/** 只接收 Supabase 校验过的身份，应用不会使用或转发上游会话令牌。 */
export async function verifySupabaseEmailCode(
  config: SupabaseOAuthConfig,
  email: string,
  token: string,
) {
  const response = await authPost(config, "verify", { email, token, type: "email" });
  if (!response || response.status >= 500) return { status: "unavailable" } as const;
  if (response.status === 429) return { status: "limited" } as const;
  if (!response.ok) return { status: "invalid" } as const;
  const result = verifiedUser.safeParse(await response.json().catch(() => null));
  if (!result.success || result.data.user.email.toLowerCase() !== email)
    return { status: "invalid" } as const;
  return { status: "verified", externalId: result.data.user.id, email } as const;
}

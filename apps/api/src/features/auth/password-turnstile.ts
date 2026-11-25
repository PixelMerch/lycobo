import { z } from "zod";

const verification = z.object({
  success: z.literal(true),
  action: z.literal("password_login"),
  hostname: z.string(),
});

/** 仅接受为当前可信来源及密码登录签发的 Turnstile 令牌。 */
export async function verifyPasswordTurnstile(
  secret: string,
  token: string,
  origin: string,
  address?: string | null,
) {
  const body = new URLSearchParams({ secret, response: token });
  if (address) body.set("remoteip", address);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return false;
    const result = verification.safeParse(await response.json());
    return result.success && result.data.hostname === new URL(origin).hostname;
  } catch {
    // 验证失败或外部服务暂不可用时关闭密码登录，不记录令牌或供应商响应。
    return false;
  }
}

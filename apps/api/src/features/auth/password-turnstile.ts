import { z } from "zod";

const verification = z.object({
  success: z.boolean(),
  action: z.string().optional(),
  hostname: z.string().optional(),
  "error-codes": z.array(z.string()).optional(),
});

type Rejection =
  | "network"
  | "unavailable"
  | "response"
  | "secret"
  | "token"
  | "expired"
  | "action"
  | "hostname";

function rejectChallenge(reason: Rejection) {
  // 只记录固定原因，避免保留令牌、地址或 Cloudflare 返回内容。
  console.warn({ event: "PASSWORD_TURNSTILE_REJECTED", reason });
  return false;
}

async function checkSiteverify(
  body: URLSearchParams,
  hostname: string,
): Promise<"verified" | Rejection> {
  let response: Response;
  try {
    response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    return "network";
  }
  if (response.status >= 500) return "unavailable";

  const result = verification.safeParse(await response.json().catch(() => null));
  if (!result.success) return "response";
  const data = result.data;
  if (data.success) {
    if (!response.ok) return "response";
    if (data.action !== "password_login") return "action";
    return data.hostname === hostname ? "verified" : "hostname";
  }
  const codes = data["error-codes"] ?? [];
  if (codes.some((code) => code === "invalid-input-secret" || code === "missing-input-secret"))
    return "secret";
  if (codes.includes("timeout-or-duplicate")) return "expired";
  return codes.includes("internal-error") ? "unavailable" : "token";
}

/** 仅接受为当前可信来源及密码登录签发的 Turnstile 令牌。 */
export async function verifyPasswordTurnstile(
  secret: string,
  token: string,
  origin: string,
  address?: string | null,
) {
  const hostname = URL.parse(origin)?.hostname;
  if (!hostname) return rejectChallenge("hostname");
  // 同一验证的瞬时故障最多重试一次，复用 Cloudflare 的幂等键。
  const body = new URLSearchParams({
    secret,
    response: token,
    idempotency_key: crypto.randomUUID(),
  });
  if (address) body.set("remoteip", address);
  const first = await checkSiteverify(body, hostname);
  const result =
    first === "network" || first === "unavailable" ? await checkSiteverify(body, hostname) : first;
  return result === "verified" || rejectChallenge(result);
}

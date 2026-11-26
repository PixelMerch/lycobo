import type { Context } from "hono";
import { getCookie } from "hono/cookie";
import type { EnterpriseAuth } from "./service";

export const enterpriseCookie = "lycobo_enterprise_session";

/** 校验 Cookie 写请求的可信来源，阻止跨站请求使用登录身份。 */
export function trustedAuthRequest(c: Context, auth: Pick<EnterpriseAuth, "config">) {
  const origin = c.req.header("Origin");
  return (
    !!origin &&
    auth.config.origins.includes(origin) &&
    c.req.header("Sec-Fetch-Site") !== "cross-site"
  );
}

/** 按原有 Bearer 与 Cookie 规则解析企业身份，供各业务路由共用。 */
export async function enterprisePrincipal(
  c: Context,
  auth: Pick<EnterpriseAuth, "authenticate" | "config">,
) {
  const authorization = c.req.header("Authorization");
  if (authorization !== undefined) {
    if (!authorization.startsWith("Bearer ")) return null;
    return auth.authenticate(authorization.slice(7));
  }
  if (c.req.header("Sec-Fetch-Site") === "cross-site") return null;
  if (!["GET", "HEAD"].includes(c.req.method) && !trustedAuthRequest(c, auth)) return null;
  const token = getCookie(c, enterpriseCookie);
  return token ? auth.authenticate(token) : null;
}

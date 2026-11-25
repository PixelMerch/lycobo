import type { Locale } from "../../i18n/locale";
import { localeFromPath, localizedPath, withoutLocale } from "../../i18n/locale-path";
import { isDashboardPath } from "../../lib/dashboard-paths";

const loginOrigin = "https://lycobo.invalid";

/** 登录后只允许返回当前产品的站内页面，保留查询参数和定位。 */
export function safeLoginReturnTo(input: unknown): string {
  if (typeof input !== "string" || !input.startsWith("/") || input.includes("\\")) return "/";
  try {
    const url = new URL(input, loginOrigin);
    if (url.origin !== loginOrigin) return "/";
    const path = withoutLocale(url.pathname);
    if (
      !isDashboardPath(path) &&
      !/^\/(?:$|commerce(?:\/|$)|workspace$|assets$|video$|inspiration$|free-canvas$)/.test(path)
    )
      return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

/** 将原始目标地址带入独立登录页面，不把凭证或草稿写进地址。 */
export function loginHref(
  returnTo: string,
  locale: Locale = localeFromPath(returnTo) ?? "en",
): string {
  return `${localizedPath("/login", locale)}?returnTo=${encodeURIComponent(safeLoginReturnTo(returnTo))}`;
}

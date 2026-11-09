const loginOrigin = "https://lycobo.invalid";

/** 登录后只允许返回当前产品的站内页面，保留查询参数和定位。 */
export function safeLoginReturnTo(input: unknown): string {
  if (typeof input !== "string" || !input.startsWith("/") || input.includes("\\")) return "/";
  try {
    const url = new URL(input, loginOrigin);
    if (url.origin !== loginOrigin) return "/";
    if (!/^\/(?:$|commerce(?:\/|$)|workspace$|assets$|video$|membership$)/.test(url.pathname))
      return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

/** 将原始目标地址带入独立登录页面，不把凭证或草稿写进地址。 */
export function loginHref(returnTo: string): string {
  return `/login?returnTo=${encodeURIComponent(safeLoginReturnTo(returnTo))}`;
}

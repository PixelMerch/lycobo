const checkoutOrigins = new Set([
  "https://creem.io",
  "https://www.creem.io",
  "https://checkout.creem.io",
  "https://l.creem.io",
]);

/** 将构建时公开的 Creem 商品付款链接与价格类型及美分金额绑定。 */
export function parseCreditCheckoutLinks(configuration: unknown) {
  const links = new Map<string, string>();
  if (typeof configuration !== "string") return links;
  let parsed: unknown;
  try {
    parsed = JSON.parse(configuration);
  } catch {
    return links;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return links;
  for (const [key, value] of Object.entries(parsed)) {
    if (!/^(offer|regular):[1-9]\d*$/.test(key) || typeof value !== "string") continue;
    const url = URL.parse(value);
    // 只接受 Creem 的公开付款地址。浏览器跳转本身不代表付款成功或积分到账。
    if (
      url &&
      checkoutOrigins.has(url.origin) &&
      !url.username &&
      !url.password &&
      url.pathname !== "/"
    )
      links.set(key, url.href);
  }
  return links;
}

/** 前端只读取公开付款链接，区分活动价和常规价对应的 Creem 商品。 */
export const creditCheckoutLinks = parseCreditCheckoutLinks(
  import.meta.env.VITE_CREEM_CREDIT_LINKS,
);

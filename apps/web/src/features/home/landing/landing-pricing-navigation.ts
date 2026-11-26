/** 公开导航和首页问答共用的价格锚点。 */
export const landingPricingPath = "/#pricing";

/** 定位首页价格并将键盘阅读焦点移到标题。 */
export function scrollToLandingPricing() {
  document.getElementById("pricing")?.scrollIntoView({ behavior: "instant" });
  document.getElementById("pricing-title")?.focus({ preventScroll: true });
}

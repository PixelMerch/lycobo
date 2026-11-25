/** 顶栏和首页锚点共用 FAQ 的滚动与阅读焦点。 */
export function scrollToLandingFaq(smooth = false) {
  const section = document.getElementById("faq");
  if (!section) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  section.scrollIntoView({ behavior: smooth && !reduceMotion ? "smooth" : "instant" });
  document.getElementById("faq-title")?.focus({ preventScroll: true });
}

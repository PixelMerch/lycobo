import type { RefObject } from "react";
import { dashboardPath } from "../../../lib/dashboard-paths";
import { siteFooterGroups, siteFooterSupportHref } from "../../site/site-footer-navigation";

const landingDestinations = new Set([
  dashboardPath,
  siteFooterSupportHref,
  ...siteFooterGroups("en").flatMap(({ links }) => links.map(({ path }) => path)),
]);

/** 宿主与隔离首页共用的窗口引用和待恢复位置。 */
export type LandingFrame = {
  frameRef: RefObject<HTMLIFrameElement | null>;
  pendingScroll: RefObject<number | null>;
};

/** 将隔离正文滚动到首页顶部或语言切换前的位置。 */
export function scrollLandingFrame(frameRef: LandingFrame["frameRef"], scrollY: number) {
  frameRef.current?.contentWindow?.postMessage({ type: "lycobo:restore-scroll", scrollY }, "*");
}

/** 通过固定区块命令定位积分价格或常见问题，距离由隔离正文自己的布局决定。 */
export function scrollLandingSection(
  frameRef: LandingFrame["frameRef"],
  section: "pricing" | "faq",
) {
  frameRef.current?.contentWindow?.postMessage(`lycobo:landing-${section}-request`, "*");
}

/** 读取隔离首页的滚动距离，拒绝非有限数值和负值。 */
export function readLandingScroll(data: unknown) {
  if (
    !data ||
    typeof data !== "object" ||
    !("type" in data) ||
    data.type !== "lycobo:landing-scroll"
  )
    return null;
  if (!("scrollY" in data)) return null;
  const { scrollY } = data;
  return typeof scrollY === "number" && Number.isFinite(scrollY) && scrollY >= 0 ? scrollY : null;
}

/** 隔离正文只允许通过宿主打开列在创作按钮和页脚中的精确地址。 */
export function readLandingNavigation(data: unknown) {
  if (!data || typeof data !== "object" || !("type" in data) || data.type !== "lycobo:navigate")
    return null;
  const path = "path" in data ? data.path : null;
  return typeof path === "string" && landingDestinations.has(path) ? path : null;
}

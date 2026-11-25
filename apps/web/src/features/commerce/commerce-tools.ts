import { dashboardToolPaths } from "../../lib/dashboard-paths";
/** 电商落地页统一使用首页地址，真实工具继续使用各自工作区路径。 */
export const commercePath = "/";

/** 可从专区开始的工具及其工作区地址，保留已保存的工具标识。 */
export const commerceTools = [
  { id: "create", href: dashboardToolPaths.create },
  { id: "textile", href: dashboardToolPaths.textile, legacyId: "textile-set" },
  { id: "variation", href: dashboardToolPaths.variation, legacyId: "smart-variation" },
  { id: "replica", href: dashboardToolPaths.replica },
] as const;

export type CommerceTool = (typeof commerceTools)[number];
export type CommerceToolId = CommerceTool["id"];

/** 读取专区当前选择，未知工具回退到主图制作。 */
export function commerceToolFromSearch(search: string): CommerceTool {
  const id = new URLSearchParams(search).get("tool");
  return commerceTools.find((tool) => tool.id === id) ?? commerceTools[0];
}

/** 生成首页工具来源地址，保留已有工具参数与定位片段。 */
export function commerceToolHref(id: CommerceToolId) {
  return `${commercePath}?tool=${id}#commerce-composer`;
}

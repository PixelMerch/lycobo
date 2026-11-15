/** 电商专区地址，用于公开浏览、工具选择和登录返回。 */
export const commercePath = "/commerce";

/** 可从专区开始的工具及其工作区地址，保留已保存的工具标识。 */
export const commerceTools = [
  { id: "create", href: "/commerce/create" },
  { id: "textile", href: "/commerce/textile-set", legacyId: "textile-set" },
  { id: "variation", href: "/commerce/smart-variation", legacyId: "smart-variation" },
  { id: "replica", href: "/commerce/replica" },
] as const;

export type CommerceTool = (typeof commerceTools)[number];
export type CommerceToolId = CommerceTool["id"];

/** 读取专区当前选择，未知工具回退到主图制作。 */
export function commerceToolFromSearch(search: string): CommerceTool {
  const id = new URLSearchParams(search).get("tool");
  return commerceTools.find((tool) => tool.id === id) ?? commerceTools[0];
}

/** 生成可分享的工具地址，指定从菜单进入时定位到创作框。 */
export function commerceToolHref(id: CommerceToolId) {
  return `${commercePath}?tool=${id}#commerce-composer`;
}

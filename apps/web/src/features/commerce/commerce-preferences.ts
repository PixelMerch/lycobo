import { commerceTools } from "./commerce-tools";

const recentToolKey = "lycobo.commerce.recent-tool";

/** 读取本机最近打开的电商工具，兼容旧版保存的家纺和套图标识。 */
export function getRecentCommercePath() {
  try {
    const saved = localStorage.getItem(recentToolKey);
    const tool = commerceTools.find(
      (entry) => entry.id === saved || ("legacyId" in entry && entry.legacyId === saved),
    );
    return tool?.href ?? commerceTools[0].href;
  } catch {
    return commerceTools[0].href;
  }
}

/** 仅记住已进入的电商工作区路径，草稿仍留在会话内存。 */
export function rememberCommercePath(path: string) {
  const id = commerceTools.find((tool) => tool.href === path)?.id;
  if (!id) return;
  try {
    localStorage.setItem(recentToolKey, id);
  } catch {
    // 浏览器禁用本地存储时仍可进入工作区。
  }
}

import { commerceTools } from "./commerce-tools";

const recentToolKey = "lycobo.commerce.recent-tool";

/** Store only a navigation preference; uploaded images and drafts stay in session memory. */
export function getRecentCommerceTool() {
  try {
    const id = localStorage.getItem(recentToolKey);
    return commerceTools.find((tool) => tool.id === id) ?? commerceTools[0];
  } catch {
    return commerceTools[0];
  }
}

export function rememberCommerceTool(id: (typeof commerceTools)[number]["id"]) {
  try {
    localStorage.setItem(recentToolKey, id);
  } catch {
    // Browsers may disable storage. Opening the workspace must still work.
  }
}

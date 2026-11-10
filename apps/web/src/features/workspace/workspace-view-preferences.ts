import { create } from "zustand";

/** 历史卡片的两档视图：大图或紧凑。 */
export type HistoryDensity = "large" | "compact";

const collapsedKey = "lycobo.workspace.composer-collapsed";
const densityKey = "lycobo.workspace.history-density";

function readPreference(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function savePreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 浏览器禁用存储时，偏好只在这次打开期间有效。
  }
}

/** 工作区的本机视图偏好：参数栏是否收起、历史卡片用大图还是紧凑视图；只存在本机浏览器里。 */
export const useWorkspaceView = create<{
  composerCollapsed: boolean;
  density: HistoryDensity;
  setComposerCollapsed: (collapsed: boolean) => void;
  setDensity: (density: HistoryDensity) => void;
}>((set) => ({
  composerCollapsed: readPreference(collapsedKey) === "true",
  density: readPreference(densityKey) === "compact" ? "compact" : "large",
  setComposerCollapsed: (composerCollapsed) => {
    savePreference(collapsedKey, String(composerCollapsed));
    set({ composerCollapsed });
  },
  setDensity: (density) => {
    savePreference(densityKey, density);
    set({ density });
  },
}));

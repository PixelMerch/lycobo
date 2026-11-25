import { create } from "zustand";
import { useRequireLogin } from "../auth/login-prompt";
import type { AssetLibraryTab } from "./asset-library-tabs";

/** 记录全局素材库的入口和初始页签，用于关闭后恢复焦点。 */
export const useAssetLibraryDialog = create<{
  isOpen: boolean;
  initialTab: AssetLibraryTab;
  opener: HTMLElement | null;
  open: (opener: HTMLElement | null, initialTab: AssetLibraryTab) => void;
  close: () => void;
}>((set) => ({
  isOpen: false,
  initialTab: "mine",
  opener: null,
  open: (opener, initialTab) => {
    // 菜单会卸载自己的选项；先把焦点放回仍然存在的入口，弹窗关闭后才能回到这里。
    opener?.focus({ preventScroll: true });
    set({ isOpen: true, opener, initialTab });
  },
  close: () => set({ isOpen: false }),
}));

/** 打开全局素材库弹窗；未登录时先去登录页，登录后回到当前页面。 */
export function useOpenAssetLibrary() {
  const requireLogin = useRequireLogin();
  const open = useAssetLibraryDialog((state) => state.open);
  return (opener: Element | null = null, initialTab: AssetLibraryTab = "mine") => {
    if (requireLogin()) open(opener instanceof HTMLElement ? opener : null, initialTab);
  };
}

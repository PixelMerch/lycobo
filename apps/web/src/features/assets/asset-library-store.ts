import { create } from "zustand";
import { useRequireLogin } from "../auth/login-prompt";

/**
 * 全局素材库弹窗的开关（用户 2026-11-10 要求点击入口直接弹窗、不跳转页面）：首页快捷入口、手机导航抽屉、
 * 账户菜单“个人作品”与页脚都从这里打开。opener 是打开它的入口，弹窗关闭后焦点回到那里。
 */
export const useAssetLibraryDialog = create<{
  isOpen: boolean;
  opener: HTMLElement | null;
  open: (opener: HTMLElement | null) => void;
  close: () => void;
}>((set) => ({
  isOpen: false,
  opener: null,
  open: (opener) => {
    // 菜单会卸载自己的选项；先把焦点放回仍然存在的入口，弹窗关闭后才能回到这里。
    opener?.focus({ preventScroll: true });
    set({ isOpen: true, opener });
  },
  close: () => set({ isOpen: false }),
}));

/** 打开全局素材库弹窗；未登录时先去登录页，登录后回到当前页面。 */
export function useOpenAssetLibrary() {
  const requireLogin = useRequireLogin();
  const open = useAssetLibraryDialog((state) => state.open);
  return (opener: Element | null = null) => {
    if (requireLogin()) open(opener instanceof HTMLElement ? opener : null);
  };
}

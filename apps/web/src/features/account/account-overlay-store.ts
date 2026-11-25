import { create } from "zustand";
import type { SettingsSection } from "./settings/settings-sections";

type AccountDialog = "recharge" | "recharge-insufficient" | "usage";
export type AccountLayer = "settings" | "dialog";

/** 管理账户设置、充值和积分明细的开合与焦点恢复。 */
export const useAccountOverlays = create<{
  settings: SettingsSection | null;
  dialog: AccountDialog | null;
  openers: Record<AccountLayer, HTMLElement | null>;
  openSettings: (section: SettingsSection, opener?: HTMLElement | null) => void;
  selectSection: (section: SettingsSection) => void;
  open: (dialog: AccountDialog, opener?: HTMLElement | null) => void;
  close: (layer: AccountLayer) => void;
  release: (layer: AccountLayer) => void;
  reset: () => void;
}>((set) => ({
  settings: null,
  dialog: null,
  openers: { settings: null, dialog: null },
  openSettings: (settings, opener = null) => {
    // 菜单和弹出层会卸载自己的按钮；先把焦点放回仍然存在的入口，弹窗关闭后才能回到这里。
    opener?.focus({ preventScroll: true });
    set((state) => ({ settings, dialog: null, openers: { ...state.openers, settings: opener } }));
  },
  selectSection: (settings) => set({ settings }),
  open: (dialog, opener = null) => {
    opener?.focus({ preventScroll: true });
    set((state) => ({ dialog, openers: { ...state.openers, dialog: opener } }));
  },
  close: (layer) => set(layer === "settings" ? { settings: null } : { dialog: null }),
  release: (layer) => set((state) => ({ openers: { ...state.openers, [layer]: null } })),
  reset: () => set({ settings: null, dialog: null, openers: { settings: null, dialog: null } }),
}));

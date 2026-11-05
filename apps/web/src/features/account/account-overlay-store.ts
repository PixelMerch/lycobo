import { create } from "zustand";
import type { AccountCenterTab } from "./account-center-tabs";

type AccountDialog = "recharge" | "membership";
export type AccountLayer = "center" | "dialog";

/**
 * The account center, recharge and membership open from the header, the account menu and the
 * center itself; one host renders them. Recharge and membership stack above an open center, and
 * each layer returns focus to its own opener.
 */
export const useAccountOverlays = create<{
  center: AccountCenterTab | null;
  dialog: AccountDialog | null;
  openers: Record<AccountLayer, HTMLElement | null>;
  openCenter: (tab: AccountCenterTab, opener?: HTMLElement | null) => void;
  selectTab: (tab: AccountCenterTab) => void;
  open: (dialog: AccountDialog, opener?: HTMLElement | null) => void;
  close: (layer: AccountLayer) => void;
  release: (layer: AccountLayer) => void;
  reset: () => void;
}>((set) => ({
  center: null,
  dialog: null,
  openers: { center: null, dialog: null },
  openCenter: (center, opener = null) => {
    // Menus and popovers unmount their buttons; focus the surviving opener first so the modal
    // records it as the place to return to.
    opener?.focus({ preventScroll: true });
    set((state) => ({ center, openers: { ...state.openers, center: opener } }));
  },
  selectTab: (center) => set({ center }),
  open: (dialog, opener = null) => {
    opener?.focus({ preventScroll: true });
    set((state) => ({ dialog, openers: { ...state.openers, dialog: opener } }));
  },
  close: (layer) => set(layer === "center" ? { center: null } : { dialog: null }),
  release: (layer) => set((state) => ({ openers: { ...state.openers, [layer]: null } })),
  reset: () => set({ center: null, dialog: null, openers: { center: null, dialog: null } }),
}));

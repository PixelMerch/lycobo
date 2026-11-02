import { lazy, Suspense, useEffect } from "react";
import { create } from "zustand";
import type { AccountCenterTab } from "./account-center-tabs";
import { RechargeDialog } from "./credits-dialog";

type AccountDialog = "recharge" | "membership";
type Layer = "center" | "dialog";

const AccountCenterDialog = lazy(() =>
  import("./account-center-dialog").then((module) => ({ default: module.AccountCenterDialog })),
);
const MembershipDialog = lazy(() =>
  import("./membership-page").then((module) => ({ default: module.MembershipDialog })),
);

/**
 * The account center, recharge and membership open from the header, the account menu and the
 * center itself; one host renders them. Recharge and membership stack above an open center, and
 * each layer returns focus to its own opener.
 */
export const useAccountOverlays = create<{
  center: AccountCenterTab | null;
  dialog: AccountDialog | null;
  openers: Record<Layer, HTMLElement | null>;
  openCenter: (tab: AccountCenterTab, opener?: HTMLElement | null) => void;
  selectTab: (tab: AccountCenterTab) => void;
  open: (dialog: AccountDialog, opener?: HTMLElement | null) => void;
  close: (layer: Layer) => void;
  release: (layer: Layer) => void;
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

/** Return focus only after the layer unmounted; a mounted modal keeps focus contained. */
function useReturnFocus(layer: Layer, isOpen: boolean) {
  const opener = useAccountOverlays((state) => state.openers[layer]);
  const release = useAccountOverlays((state) => state.release);
  useEffect(() => {
    if (isOpen || !opener) return;
    release(layer);
    if (opener.isConnected) opener.focus({ preventScroll: true });
  }, [isOpen, layer, opener, release]);
}

/** `onNavigate` closes the phone navigation drawer when a link inside the center leaves the page. */
export function AccountOverlayHost({ onNavigate }: { onNavigate?: () => void }) {
  const center = useAccountOverlays((state) => state.center);
  const dialog = useAccountOverlays((state) => state.dialog);
  const close = useAccountOverlays((state) => state.close);
  const reset = useAccountOverlays((state) => state.reset);
  useReturnFocus("center", center !== null);
  useReturnFocus("dialog", dialog !== null);
  // Signing out unmounts the host; nothing reopens after the next sign-in.
  useEffect(() => reset, [reset]);
  return (
    <>
      {center !== null && (
        <Suspense fallback={null}>
          <AccountCenterDialog
            tab={center}
            onClose={() => close("center")}
            onLeave={() => {
              close("center");
              onNavigate?.();
            }}
          />
        </Suspense>
      )}
      {dialog === "recharge" && <RechargeDialog onClose={() => close("dialog")} />}
      {dialog === "membership" && (
        <Suspense fallback={null}>
          <MembershipDialog onClose={() => close("dialog")} />
        </Suspense>
      )}
    </>
  );
}

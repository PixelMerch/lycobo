import { lazy, Suspense, useEffect } from "react";
import { create } from "zustand";
import { RechargeDialog } from "./credits-dialog";

type AccountOverlay = "recharge" | "membership";

const MembershipDialog = lazy(() =>
  import("./membership-page").then((module) => ({ default: module.MembershipDialog })),
);

/**
 * Recharge and membership open from the header, the account menu and the account center; one
 * host renders them so only a single account overlay exists. Focus returns to the opener.
 */
export const useAccountOverlays = create<{
  overlay: AccountOverlay | null;
  opener: HTMLElement | null;
  open: (overlay: AccountOverlay, opener?: HTMLElement | null) => void;
  close: () => void;
  release: () => void;
}>((set) => ({
  overlay: null,
  opener: null,
  open: (overlay, opener = null) => {
    // Menus and popovers unmount their buttons; focus the surviving opener first so the modal
    // records it as the place to return to.
    opener?.focus({ preventScroll: true });
    set({ overlay, opener });
  },
  close: () => set({ overlay: null }),
  release: () => set({ opener: null }),
}));

export function AccountOverlayHost() {
  const overlay = useAccountOverlays((state) => state.overlay);
  const opener = useAccountOverlays((state) => state.opener);
  const close = useAccountOverlays((state) => state.close);
  const release = useAccountOverlays((state) => state.release);
  // Return focus only after the overlay unmounted; a mounted modal keeps focus contained.
  useEffect(() => {
    if (overlay !== null || !opener) return;
    release();
    if (opener.isConnected) opener.focus({ preventScroll: true });
  }, [overlay, opener, release]);
  if (overlay === "recharge") return <RechargeDialog onClose={close} />;
  if (overlay === "membership")
    return (
      <Suspense fallback={null}>
        <MembershipDialog onClose={close} />
      </Suspense>
    );
  return null;
}

import { lazy, Suspense, useEffect } from "react";
import { type AccountLayer, useAccountOverlays } from "./account-overlay-store";
import { RechargeDialog } from "./credits-dialog";

const AccountCenterDialog = lazy(() =>
  import("./account-center-dialog").then((module) => ({ default: module.AccountCenterDialog })),
);
const MembershipDialog = lazy(() =>
  import("./membership-page").then((module) => ({ default: module.MembershipDialog })),
);

/** Return focus only after the layer unmounted; a mounted modal keeps focus contained. */
function useReturnFocus(layer: AccountLayer, isOpen: boolean) {
  const opener = useAccountOverlays((state) => state.openers[layer]);
  const release = useAccountOverlays((state) => state.release);
  useEffect(() => {
    if (isOpen || !opener) return;
    release(layer);
    if (opener.isConnected) opener.focus({ preventScroll: true });
  }, [isOpen, layer, opener, release]);
}

/** One host renders the account layers and restores each opener on close. */
export function AccountOverlayHost() {
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
          <AccountCenterDialog tab={center} onClose={() => close("center")} />
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

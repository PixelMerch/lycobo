import { lazy, Suspense, useEffect } from "react";
import { type AccountLayer, useAccountOverlays } from "./account-overlay-store";
import { RechargeDialog } from "./credits/credits-dialog";

const AccountSettingsDialog = lazy(() =>
  import("./settings/account-settings-dialog").then((module) => ({
    default: module.AccountSettingsDialog,
  })),
);
const MembershipDialog = lazy(() =>
  import("./membership/membership-page").then((module) => ({ default: module.MembershipDialog })),
);
const CreditUsageDialog = lazy(() =>
  import("./credits/credit-usage-dialog").then((module) => ({
    default: module.CreditUsageDialog,
  })),
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

/** 统一挂载账户相关弹层（账户设置及叠在其上的充值、会员、积分明细），关闭后各自把焦点还给打开它的入口。 */
export function AccountOverlayHost() {
  const settings = useAccountOverlays((state) => state.settings);
  const dialog = useAccountOverlays((state) => state.dialog);
  const close = useAccountOverlays((state) => state.close);
  const reset = useAccountOverlays((state) => state.reset);
  useReturnFocus("settings", settings !== null);
  useReturnFocus("dialog", dialog !== null);
  // 退出登录会卸载这里并清空状态，下次登录后不会自动重开任何弹层。
  useEffect(() => reset, [reset]);
  return (
    <>
      {settings !== null && (
        <Suspense fallback={null}>
          <AccountSettingsDialog section={settings} onClose={() => close("settings")} />
        </Suspense>
      )}
      {dialog === "recharge" && <RechargeDialog onClose={() => close("dialog")} />}
      {dialog === "membership" && (
        <Suspense fallback={null}>
          <MembershipDialog onClose={() => close("dialog")} />
        </Suspense>
      )}
      {dialog === "usage" && (
        <Suspense fallback={null}>
          <CreditUsageDialog onClose={() => close("dialog")} />
        </Suspense>
      )}
    </>
  );
}

import { lazy, Suspense, useEffect } from "react";
import { type AccountLayer, useAccountOverlays } from "./account-overlay-store";

const AccountSettingsDialog = lazy(() =>
  import("./settings/account-settings-dialog").then((module) => ({
    default: module.AccountSettingsDialog,
  })),
);
const RechargeDialog = lazy(() =>
  import("./credits/credits-dialog").then((module) => ({ default: module.RechargeDialog })),
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

/** 按需挂载账户设置、充值和积分明细，并在关闭后恢复入口焦点。 */
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
      {dialog === "recharge" && (
        <Suspense fallback={null}>
          <RechargeDialog onClose={() => close("dialog")} />
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

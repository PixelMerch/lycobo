import { EmptyState } from "@heroui/react";
import { checkoutReturnSchema } from "@lycoboai/contracts";
import { useEffect } from "react";
import { RouteLink } from "../../components/router-link";
import { useMessages } from "../../i18n/messages";
import { useAppLocation, useAppNavigate } from "../../i18n/use-localized-navigation";
import { notifyCheckoutReturn } from "./checkout-window";
import { creditsMessages } from "./credits/credits-messages";

/** 从支付窗口回到工作台；原窗口不可用时在当前窗口恢复原站内路径。 */
export function CheckoutReturnPage() {
  const t = useMessages(creditsMessages);
  const navigate = useAppNavigate();
  const { search } = useAppLocation();
  const params = new URLSearchParams(search);
  const route = checkoutReturnSchema.safeParse({
    flow: params.get("flow"),
    from: params.get("from"),
  }).data;
  const from = route?.from ?? "/";
  const flow = route?.flow;
  useEffect(() => {
    const stop = flow && notifyCheckoutReturn(flow);
    // 原窗口被关闭或浏览器禁用窗口通信时，仍能回到发起充值的页面。
    const fallback = window.setTimeout(
      () => void navigate(from, { replace: true }),
      stop ? 800 : 0,
    );
    return () => {
      window.clearTimeout(fallback);
      if (stop) stop();
    };
  }, [flow, from, navigate]);
  return (
    <main className="route-status">
      <EmptyState className="route-status-card">
        <h1>{t.checkoutReturning}</h1>
        <div className="route-status-actions">
          <RouteLink to={from}>{t.checkoutReturn}</RouteLink>
        </div>
      </EmptyState>
    </main>
  );
}

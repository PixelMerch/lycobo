import { IconArrowLeft } from "@tabler/icons-react";
import { useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router";
import { RouteLink } from "../../../components/router-link";
import { UiIcon } from "../../../components/ui-icon";
import { withoutLocale } from "../../../i18n/locale-path";
import { useMessages } from "../../../i18n/messages";
import { dashboardPath } from "../../../lib/dashboard-paths";
import { useEnterpriseSession } from "../../auth/auth-client";
import { safeLoginReturnTo } from "../../auth/login-navigation";
import { SiteFooter } from "../../site/site-footer";
import { CreditPacks } from "./credit-packs";
import { creditsMessages } from "./credits-messages";
import { rechargePath } from "./recharge-navigation";
import "./credit-recharge.css";

/** 完整充值页展示积分包和活动信息，并提供安全的站内返回入口。 */
export function RechargePage() {
  const t = useMessages(creditsMessages);
  const { data: account } = useEnterpriseSession();
  const title = useRef<HTMLHeadingElement>(null);
  const state: unknown = useLocation().state;
  const requested =
    typeof state === "object" && state !== null && "returnTo" in state ? state.returnTo : undefined;
  const safeTarget = safeLoginReturnTo(requested);
  const targetPath = withoutLocale(safeTarget).split(/[?#]/, 1)[0];
  const defaultTarget = account ? dashboardPath : "/";
  const returnTo =
    safeTarget === requested && targetPath !== rechargePath && targetPath !== "/membership"
      ? safeTarget
      : defaultTarget;

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    title.current?.focus({ preventScroll: true });
  }, []);

  return (
    <>
      <article className="credit-recharge-page" aria-labelledby="recharge-title">
        <div className="credit-recharge-content">
          <RouteLink to={returnTo} className="credit-recharge-back">
            <UiIcon icon={IconArrowLeft} size="small" />
            {t.backFromRecharge}
          </RouteLink>
          <header className="credit-recharge-heading">
            <h1 id="recharge-title" ref={title} tabIndex={-1}>
              {t.recharge}
            </h1>
            <p>{t.rechargeDescription}</p>
          </header>
          <CreditPacks />
        </div>
      </article>
      <SiteFooter />
    </>
  );
}

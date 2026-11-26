import { Button } from "@heroui/react";
import { checkoutOptionsSchema, creditPacks, unwrapApiData } from "@lycoboai/contracts";
import { IconSparkle } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { localizedPath } from "../../../i18n/locale-path";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { dashboardToolPaths } from "../../../lib/dashboard-paths";
import { useAccountOverlays } from "../../account/account-overlay-store";
import { creditPackDisplay } from "../../account/credits/credit-pack-pricing";
import { creditsMessages } from "../../account/credits/credits-messages";
import { useEnterpriseSession } from "../../auth/auth-client";
import { loginHref } from "../../auth/login-navigation";
import { LandingActionLink } from "./landing-action-link";
import { landingPricingMessages } from "./landing-pricing-messages";
import "../../account/credits/credit-recharge.css";
import "./landing-pricing-section.css";

const publicOfferSchema = checkoutOptionsSchema.pick({ offerEnd: true });
const maxBrowserTimeout = 2_147_483_647;
const featuredPacks: Partial<
  Record<(typeof creditPacks)[number]["id"], "recommended" | "best-rate">
> = {
  production: "recommended",
  bulk: "best-rate",
};

function usePublicCreditOffer() {
  const { data } = useQuery({
    queryKey: ["public-credit-pricing"],
    staleTime: 60_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await fetch("/api/v1/credit-pricing", {
        credentials: "omit",
        signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      });
      if (!response.ok) return null;
      return publicOfferSchema.parse(unwrapApiData(await response.json()));
    },
  });
  const [now, setNow] = useState(Date.now);
  const end = data ? Date.parse(data.offerEnd) : 0;
  useEffect(() => {
    const remaining = end - Math.max(now, Date.now());
    if (remaining <= 0) return;
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      Math.min(remaining, maxBrowserTimeout),
    );
    return () => window.clearTimeout(timer);
  }, [end, now]);
  // 读取配置失败时仍展示常规价，避免使用未经确认的活动价。
  return end > Math.max(now, Date.now());
}

/** 访客可比较五档一次性积分包，登录后使用现有充值弹框。 */
export function LandingPricingSection() {
  const locale = useLocale();
  const t = useMessages(landingPricingMessages);
  const packText = useMessages(creditsMessages);
  const includeOffer = usePublicCreditOffer();
  const account = useEnterpriseSession();
  const openOverlay = useAccountOverlays((state) => state.open);

  return (
    <section id="pricing" className="lp-pricing" aria-labelledby="pricing-title">
      <div className="lp-container lp-pricing-inner">
        <header className="lp-pricing-heading">
          <h2 id="pricing-title" className="lp-section-title" tabIndex={-1}>
            {t.title}
          </h2>
          <p className="lp-section-description">{t.description}</p>
        </header>
        <ul className="credit-pack-grid" aria-label={packText.packs}>
          {creditPacks.map((pack) => {
            const display = creditPackDisplay(pack, locale, undefined, includeOffer);
            const featured = featuredPacks[pack.id];
            return (
              <li key={pack.id} className="credit-pack" data-featured={featured}>
                {featured && (
                  <span className="credit-pack-recommendation">
                    {featured === "recommended" ? packText.recommendedPack : packText.bulkPack}
                  </span>
                )}
                <div className="credit-pack-surface">
                  <h3 className="credit-pack-value">
                    <UiIcon icon={IconSparkle} size="small" />
                    <strong>{display.credits}</strong>
                    <span>{packText.creditUnits}</span>
                  </h3>
                  {includeOffer && (
                    <span className="credit-pack-bonus">
                      {packText.bonusCredits(display.bonus, display.bonusRate)}
                    </span>
                  )}
                  <p className="credit-pack-description">{packText.packDescriptions[pack.id]}</p>
                  <span className="credit-pack-yield">{packText.aboutImages(display.images)}</span>
                  {display.imageRate !== null && display.cnyImageRate !== null && (
                    <span className="credit-pack-rate">
                      {packText.perImage(display.imageRate, display.cnyImageRate)}
                    </span>
                  )}
                  <div className="credit-pack-buy-area">
                    <div className="credit-pack-prices">
                      <span className="credit-pack-price">{display.price} USD</span>
                      {includeOffer && (
                        <span className="credit-pack-regular">
                          <span className="visually-hidden">{packText.regularPrice}</span>
                          <s>{display.regularPrice}</s>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="lp-pricing-actions">
          <p>{t.checkoutNote}</p>
          {account.data ? (
            <Button
              variant="secondary"
              className="lp-btn-primary"
              onPress={({ target }) =>
                openOverlay("recharge", target instanceof HTMLElement ? target : null)
              }
            >
              {t.topUp}
            </Button>
          ) : (
            <LandingActionLink
              to={loginHref(localizedPath(dashboardToolPaths.create, locale), locale)}
            >
              {t.signIn}
            </LandingActionLink>
          )}
        </div>
      </div>
    </section>
  );
}

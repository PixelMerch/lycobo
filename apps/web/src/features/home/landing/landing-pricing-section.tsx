import { checkoutOptionsSchema, creditPacks, unwrapApiData } from "@lycoboai/contracts";
import { IconSparkle } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useEffectEvent, useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { localizedPath } from "../../../i18n/locale-path";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { useAppLocation } from "../../../i18n/use-localized-navigation";
import { CheckoutAction } from "../../account/credits/checkout-action";
import { creditPackDisplay } from "../../account/credits/credit-pack-pricing";
import { creditsMessages } from "../../account/credits/credits-messages";
import { useCheckoutOptions, useCreditCheckout } from "../../account/wallet-client";
import { useEnterpriseSession } from "../../auth/auth-client";
import { ImageApiError } from "../../generation/image-request";
import {
  clearPricingCheckout,
  consumePricingCheckout,
  rememberPricingCheckout,
} from "./landing-pricing-checkout";
import { landingPricingMessages } from "./landing-pricing-messages";
import "../../account/credits/credit-recharge.css";
import "./landing-pricing-section.css";

const publicOfferSchema = checkoutOptionsSchema.pick({ offerEnd: true });
const maxBrowserTimeout = 2_147_483_647;
const LandingPricingLogin = lazy(async () => ({
  default: (await import("./landing-pricing-login")).LandingPricingLogin,
}));
const featuredPacks: Partial<
  Record<(typeof creditPacks)[number]["id"], "recommended" | "best-rate">
> = {
  production: "recommended",
  bulk: "best-rate",
};

function usePublicCreditOffer(offerEndFromCheckout: string | undefined, publicFallback: boolean) {
  const { data } = useQuery({
    queryKey: ["public-credit-pricing"],
    enabled: publicFallback,
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
  const offerEnd = offerEndFromCheckout ?? data?.offerEnd;
  const end = offerEnd ? Date.parse(offerEnd) : 0;
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

/** 访客可比较五档积分包并弹框登录，登录后直达所选档位的结账。 */
export function LandingPricingSection() {
  const locale = useLocale();
  const t = useMessages(landingPricingMessages);
  const packText = useMessages(creditsMessages);
  const account = useEnterpriseSession();
  const signedIn = !!account.data;
  const { data: options, isError: optionsFailed } = useCheckoutOptions();
  const checkout = useCreditCheckout("#pricing");
  // 已登录的档位接口包含活动截止时间；公开接口只为访客与失败回退读取。
  const includeOffer = usePublicCreditOffer(
    options?.offerEnd,
    (!account.isPending && !signedIn) || optionsFailed,
  );
  const { search } = useAppLocation();
  const [login, setLogin] = useState<{ pack: string; returnTo: string } | null>(null);
  const resumeCheckout = useEffectEvent((intentSearch: string) => {
    const pack = consumePricingCheckout(intentSearch);
    if (pack) checkout.buy(pack, false);
  });
  useEffect(() => {
    if (signedIn && !login) resumeCheckout(search);
  }, [signedIn, login, search]);

  function buyPack(pack: string) {
    if (signedIn) {
      checkout.buy(pack);
      return;
    }
    setLogin({ pack, returnTo: localizedPath(rememberPricingCheckout(pack), locale) });
  }

  function closeLogin() {
    clearPricingCheckout();
    setLogin(null);
  }

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
            const selected = checkout.variables?.endsWith(`:${pack.id}`) === true;
            const pending = selected && checkout.isOpening;
            const unavailable = signedIn && !options?.packs.includes(display.checkoutKey);
            return (
              <LandingPricingPack
                key={pack.id}
                id={pack.id}
                display={display}
                includeOffer={includeOffer}
                pending={pending}
                disabled={account.isPending || (!pending && (unavailable || checkout.isOpening))}
                error={selected ? checkout.error : null}
                checkoutUrl={selected ? checkout.url : undefined}
                focusCheckout={checkout.focusCheckout}
                onBuy={buyPack}
              />
            );
          })}
        </ul>
        <p className="credit-recharge-note">{t.checkoutNote}</p>
      </div>
      {login && (
        <Suspense fallback={null}>
          <LandingPricingLogin
            returnTo={login.returnTo}
            onClose={closeLogin}
            onSuccess={() => {
              const pack = login.pack;
              closeLogin();
              checkout.buy(pack, false);
            }}
          />
        </Suspense>
      )}
    </section>
  );
}

/** 用同一套充值卡片样式展示档位，并提供对应的付款反馈。 */
function LandingPricingPack({
  id,
  display,
  includeOffer,
  pending,
  disabled,
  error,
  checkoutUrl,
  focusCheckout,
  onBuy,
}: {
  id: (typeof creditPacks)[number]["id"];
  display: ReturnType<typeof creditPackDisplay>;
  includeOffer: boolean;
  pending: boolean;
  disabled: boolean;
  error: Error | null;
  checkoutUrl: string | undefined;
  focusCheckout: () => boolean;
  onBuy: (pack: string) => void;
}) {
  const t = useMessages(landingPricingMessages);
  const packText = useMessages(creditsMessages);
  const featured = featuredPacks[id];
  return (
    <li className="credit-pack" data-featured={featured}>
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
        <p className="credit-pack-description">{packText.packDescriptions[id]}</p>
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
          <CheckoutAction
            url={checkoutUrl}
            focus={focusCheckout}
            label={t.topUpPack(display.credits)}
            buy={t.topUp}
            pending={pending}
            disabled={disabled}
            onBuy={() => onBuy(display.checkoutKey)}
          />
          {error && (
            <p className="credit-pack-error" role="alert">
              {error instanceof ImageApiError ? error.message : packText.checkoutFailed}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

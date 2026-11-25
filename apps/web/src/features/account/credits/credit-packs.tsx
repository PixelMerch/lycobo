import { Button, Link } from "@heroui/react";
import { imageUnitCredits } from "@lycoboai/contracts";
import { IconSparkle } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { useEnterpriseSession } from "../../auth/auth-client";
import { useWallet } from "../wallet-client";
import { creditCheckoutLinks } from "./credit-checkout-links";
import { CreditOffer, useCreditOffer } from "./credit-offer";
import { cnyPerUsdEstimate, creditPackDisplay, creditPacks } from "./credit-pack-pricing";
import { creditsMessages } from "./credits-messages";

const featuredPacks: Partial<
  Record<(typeof creditPacks)[number]["id"], "recommended" | "best-rate">
> = { production: "recommended", bulk: "best-rate" };

/** 展示积分包、出图估算、推荐档位与对应的 Creem 付款入口。 */
export function CreditPacks() {
  const t = useMessages(creditsMessages);
  const wallet = useWallet();
  const { data: account } = useEnterpriseSession();
  const locale = useLocale();
  const offer = useCreditOffer();
  const unit = wallet.data?.unitCredits ?? imageUnitCredits;
  const packs = creditPacks.map((pack) => {
    const display = creditPackDisplay(pack, locale, unit, offer.includeOffer);
    return {
      id: pack.id,
      featured: featuredPacks[pack.id],
      display,
      hasBonus: offer.includeOffer && pack.bonusCredits > 0,
      checkout: account ? creditCheckoutLinks.get(display.checkoutKey) : undefined,
    };
  });
  return (
    <>
      {offer.includeOffer && <CreditOffer seconds={offer.seconds} />}
      <section aria-label={t.packs}>
        <ul className="credit-pack-grid">
          {packs.map(({ id, featured, display, hasBonus, checkout }) => (
            <li key={id} className="credit-pack" data-featured={featured}>
              {featured && (
                <span className="credit-pack-recommendation">
                  {featured === "recommended" ? t.recommendedPack : t.bulkPack}
                </span>
              )}
              <h2 className="credit-pack-value">
                <UiIcon icon={IconSparkle} size="small" />
                <strong>{display.credits}</strong>
                <span>{t.creditUnits}</span>
              </h2>
              {hasBonus && (
                <span className="credit-pack-bonus">
                  {t.bonusCredits(display.bonus, display.bonusRate)}
                </span>
              )}
              <p className="credit-pack-description">{t.packDescriptions[id]}</p>
              <span className="credit-pack-yield">{t.aboutImages(display.images)}</span>
              {display.imageRate !== null && display.cnyImageRate !== null && (
                <span className="credit-pack-rate">
                  {t.perImage(display.imageRate, display.cnyImageRate)}
                </span>
              )}
              <div className="credit-pack-buy-area">
                <div className="credit-pack-prices">
                  <span className="credit-pack-price">{display.price} USD</span>
                  {offer.includeOffer && (
                    <span className="credit-pack-regular">
                      <span className="visually-hidden">{t.regularPrice}</span>
                      <s>{display.regularPrice}</s>
                    </span>
                  )}
                </div>
                {checkout ? (
                  <Link
                    href={checkout}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="credit-pack-buy"
                    aria-label={t.buyPack(display.credits)}
                  >
                    {t.buyNow}
                  </Link>
                ) : (
                  <Button
                    isDisabled
                    variant="primary"
                    className="credit-pack-buy"
                    aria-label={t.buyPack(display.credits)}
                  >
                    {t.buyNow}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="credit-recharge-note">
          {t.rechargeNote(unit, cnyPerUsdEstimate, offer.includeOffer)}
        </p>
      </section>
    </>
  );
}

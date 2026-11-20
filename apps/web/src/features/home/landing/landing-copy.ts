import { imageUnitCredits } from "@lycoboai/contracts";
import type { Locale } from "../../../i18n/locale";
import { creditPackDisplay, creditPacks } from "../../account/credits/credit-pack-pricing";
import { siteFooterMessages } from "../../site/site-footer-messages";
import { landingFaqMessages } from "./landing-faq-messages";
import { landingFooterMessages } from "./landing-footer-messages";
import { landingMessages } from "./landing-messages";
import { landingPricingMessages } from "./landing-pricing-messages";
import { landingReviewsMessages } from "./landing-reviews-messages";

/** 将首页文案及公开美元价格交给隔离正文，图片估算共用实际图片单价。 */
export function landingCopy(locale: Locale): Record<string, string> {
  const footer = siteFooterMessages[locale];
  const pricing = landingPricingMessages[locale];
  return {
    ...landingMessages[locale],
    ...landingFaqMessages[locale],
    ...landingFooterMessages[locale],
    ...landingReviewsMessages[locale],
    ...pricing,
    pricingEstimate: pricing.pricingEstimate.replace("{unit}", String(imageUnitCredits)),
    ...Object.fromEntries(
      creditPacks.map((pack) => [
        `pricingRate${pack.credits}`,
        pricing.pricingRate.replace("{price}", creditPackDisplay(pack, locale).rate),
      ]),
    ),
    footerNavigation: footer.navigation,
    footerCopyright: footer.copyright(new Date().getFullYear()),
  };
}

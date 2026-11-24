import { imageUnitCredits } from "@lycoboai/contracts";
import type { Locale } from "../../../i18n/locale";
import { creditPackDisplay, creditPacks } from "../../account/credits/credit-pack-pricing";
import { variationMessages } from "../../commerce/smart-variation/variation-messages";
import { landingFaqMessages } from "./landing-faq-messages";
import { landingMessages } from "./landing-messages";
import { landingPricingMessages } from "./landing-pricing-messages";
import { landingReviewsMessages } from "./landing-reviews-messages";

/** 将首页文案及公开美元价格交给隔离正文，图片估算共用实际图片单价。 */
export function landingCopy(locale: Locale): Record<string, string> {
  const pricing = landingPricingMessages[locale];
  const planner = variationMessages[locale];
  return {
    ...landingMessages[locale],
    ...landingFaqMessages[locale],
    ...landingReviewsMessages[locale],
    ...pricing,
    plannerBriefLabel: planner.brief,
    plannerPromptHeading: planner.confirmPrompts,
    plannerUsesImages: planner.usesImages,
    plannerReferenceImage: planner.sourceImage(1),
    pricingEstimate: pricing.pricingEstimate.replace("{unit}", String(imageUnitCredits)),
    ...Object.fromEntries(
      creditPacks.map((pack) => [
        `pricingRate${pack.credits}`,
        pricing.pricingRate.replace("{price}", creditPackDisplay(pack, locale).rate),
      ]),
    ),
  };
}

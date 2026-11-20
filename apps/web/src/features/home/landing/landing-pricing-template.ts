import type { Locale } from "../../../i18n/locale";
import { creditPackDisplay, creditPacks } from "../../account/credits/credit-pack-pricing";
import pricingTemplate from "./landing-pricing.html?raw";
import cardTemplate from "./landing-pricing-card.html?raw";

/** 从共用美元目录生成四张独立积分卡片，本地化正文由外层渲染器统一转义。 */
export function renderLandingPricing(locale: Locale) {
  const cards = creditPacks.map((pack) => {
    const values: Record<string, string> = {
      ...creditPackDisplay(pack, locale),
      value: String(pack.credits),
    };
    return cardTemplate
      .replace(/__LYCOBO_PACK_([a-z]+)__/g, (_, key: string) => values[key] ?? "")
      .replace("__LYCOBO_HTML_pricingRate__", `__LYCOBO_HTML_pricingRate${pack.credits}__`);
  });
  return pricingTemplate.replace("__LYCOBO_PRICING_CARDS__", () => cards.join("\n"));
}

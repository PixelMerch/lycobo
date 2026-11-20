import type { Locale } from "../../../i18n/locale";
import {
  creditPackDisplay,
  creditPacks,
  defaultCreditPack,
} from "../../account/credits/credit-pack-pricing";
import pricingTemplate from "./landing-pricing.html?raw";
import optionTemplate from "./landing-pricing-option.html?raw";
import summaryTemplate from "./landing-pricing-summary.html?raw";

function renderPack(template: string, pack: (typeof creditPacks)[number], locale: Locale) {
  const values: Record<string, string> = {
    ...creditPackDisplay(pack, locale),
    value: String(pack.credits),
    checked: pack === defaultCreditPack ? "checked" : "",
  };
  // 仅插入固定档位的数字与货币格式；本地化正文仍由外层渲染器统一转义。
  return template
    .replace(/__LYCOBO_PACK_([a-z]+)__/g, (_, key: string) => values[key] ?? "")
    .replace("__LYCOBO_HTML_pricingRate__", `__LYCOBO_HTML_pricingRate${pack.credits}__`);
}

/** 用共用美元目录生成原生单选档位及摘要，CSS 根据选中状态同步展示，无需额外运行时。 */
export function renderLandingPricing(locale: Locale) {
  return pricingTemplate
    .replace("__LYCOBO_PRICING_OPTIONS__", () =>
      creditPacks.map((pack) => renderPack(optionTemplate, pack, locale)).join("\n"),
    )
    .replace("__LYCOBO_PRICING_SUMMARIES__", () =>
      creditPacks.map((pack) => renderPack(summaryTemplate, pack, locale)).join("\n"),
    );
}

/** 按固定目录生成选中态选择器，保证新增档位不会与展示条件脱节。 */
export function landingPricingSelectionStyles() {
  return creditPacks
    .map(
      ({ credits }) =>
        `.landing-pricing-layout:has(input[value="${credits}"]:checked) [data-pricing-pack="${credits}"] { display: flex; }`,
    )
    .join("\n");
}

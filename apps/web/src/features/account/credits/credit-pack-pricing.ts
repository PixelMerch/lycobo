import { imageUnitCredits } from "@lycoboai/contracts";
import type { Locale } from "../../../i18n/locale";

/** 一次性充值的美元展示目录，金额使用美分。支付与到账应由服务端确认。 */
export const creditPacks = [
  { id: "trial", credits: 102, offerAmountMinor: 299, bonusCredits: 2 },
  { id: "starter", credits: 680, offerAmountMinor: 1999, bonusCredits: 40 },
  { id: "catalog", credits: 1360, offerAmountMinor: 3999, bonusCredits: 110 },
  { id: "production", credits: 2040, offerAmountMinor: 5999, bonusCredits: 230 },
  { id: "bulk", credits: 3400, offerAmountMinor: 9999, bonusCredits: 480 },
] as const;

/** 人民币出图估算使用预留汇率波动空间的定价基准。 */
export const cnyPerUsdEstimate = 6.8;

/** 本地化显示基础积分、赠送、应付金额，以及按当前档位估算的图片数量与单价。 */
export function creditPackDisplay(
  pack: (typeof creditPacks)[number],
  locale: Locale,
  unitCredits = imageUnitCredits,
  includeOffer = false,
) {
  const number = new Intl.NumberFormat(locale);
  const currency = (digits: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  const bonus = includeOffer ? pack.bonusCredits : 0;
  const total = pack.credits + bonus;
  const regularAmountMinor = Math.round((pack.offerAmountMinor * 3) / 2);
  const amountMinor = includeOffer ? pack.offerAmountMinor : regularAmountMinor;
  const amount = amountMinor / 100;
  const imageCount = unitCredits > 0 ? Math.floor(total / unitCredits) : 0;
  const imageRate = imageCount > 0 ? amount / imageCount : null;
  const cny = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "CNY",
    currencyDisplay: "narrowSymbol",
  });
  return {
    credits: number.format(pack.credits),
    bonus: number.format(bonus),
    bonusRate: new Intl.NumberFormat(locale, { style: "percent" }).format(bonus / pack.credits),
    // 不同积分包的活动价与常规价可能相同，付款链接必须区分价格类型。
    checkoutKey: `${includeOffer ? "offer" : "regular"}:${amountMinor}`,
    price: currency(2).format(amount),
    regularPrice: currency(2).format(regularAmountMinor / 100),
    imageRate: imageRate === null ? null : currency(3).format(imageRate),
    cnyImageRate: imageRate === null ? null : cny.format(imageRate * cnyPerUsdEstimate),
    images: number.format(imageCount),
  };
}

import { type creditPacks, imageUnitCredits, pricedCreditPack } from "@lycoboai/contracts";
import type { Locale } from "../../../i18n/locale";

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
  const {
    amount: amountMinor,
    credits: total,
    key: checkoutKey,
  } = pricedCreditPack(pack, includeOffer);
  const regularAmountMinor = pricedCreditPack(pack, false).amount;
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
    checkoutKey,
    price: currency(2).format(amount),
    regularPrice: currency(2).format(regularAmountMinor / 100),
    imageRate: imageRate === null ? null : currency(3).format(imageRate),
    cnyImageRate: imageRate === null ? null : cny.format(imageRate * cnyPerUsdEstimate),
    images: number.format(imageCount),
  };
}

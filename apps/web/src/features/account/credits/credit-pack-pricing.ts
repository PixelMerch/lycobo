import { imageUnitCredits } from "@lycoboai/contracts";
import type { Locale } from "../../../i18n/locale";

/** 已确认的美元积分档位；金额使用美分，仅供展示，不能作为浏览器确认支付或入账的依据。 */
export const creditPacks = [
  { credits: 1000, amountMinor: 2990 },
  { credits: 3000, amountMinor: 5990 },
  { credits: 7000, amountMinor: 9990 },
] as const;

/** 落地页与账户充值默认选择中间档。 */
export const defaultCreditPack = creditPacks[1];

/** 将公开档位格式化为本地化美元价格及图片估算，不推断积分有效期、赠送或支付状态。 */
export function creditPackDisplay(
  pack: (typeof creditPacks)[number],
  locale: Locale,
  unitCredits = imageUnitCredits,
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
  return {
    credits: number.format(pack.credits),
    price: currency(2).format(pack.amountMinor / 100),
    rate: currency(4).format(pack.amountMinor / 100 / pack.credits),
    images: number.format(unitCredits > 0 ? Math.floor(pack.credits / unitCredits) : 0),
  };
}

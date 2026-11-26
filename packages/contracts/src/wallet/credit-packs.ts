import { z } from "zod";

/** 前后端共享一次性积分包目录，基础积分对应支付渠道交付，美元金额统一使用美分。 */
export const creditPacks = [
  { id: "trial", credits: 102, offerAmountMinor: 299, bonusCredits: 2 },
  { id: "starter", credits: 700, offerAmountMinor: 1999, bonusCredits: 40 },
  { id: "catalog", credits: 1480, offerAmountMinor: 3999, bonusCredits: 120 },
  { id: "production", credits: 2540, offerAmountMinor: 5999, bonusCredits: 280 },
  { id: "bulk", credits: 4800, offerAmountMinor: 9999, bonusCredits: 680 },
] as const;

export const defaultCreditOfferEnd = "2026-12-06T16:00:00Z";
export const checkoutPackSchema = z
  .string()
  .regex(/^(offer|regular):(trial|starter|catalog|production|bulk)$/);
export const checkoutOptionsSchema = z.object({
  packs: z.array(checkoutPackSchema),
  offerEnd: z.iso.datetime(),
});
export const creditCheckoutSchema = z.object({ url: z.url({ protocol: /^https$/ }) });

/** 解析服务端与展示共用的活动截止时间。 */
export function creditOfferEnd(value: unknown) {
  return z.iso.datetime().safeParse(value).data ?? defaultCreditOfferEnd;
}

/** 生成可售价格和到账积分，活动与常规定价用稳定套餐编号区分。 */
export function pricedCreditPack(pack: (typeof creditPacks)[number], includeOffer: boolean) {
  return {
    key: `${includeOffer ? "offer" : "regular"}:${pack.id}`,
    credits: pack.credits + (includeOffer ? pack.bonusCredits : 0),
    amount: includeOffer ? pack.offerAmountMinor : Math.round((pack.offerAmountMinor * 3) / 2),
  };
}

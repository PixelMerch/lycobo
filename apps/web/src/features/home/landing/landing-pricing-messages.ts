import { imageUnitCredits } from "@lycoboai/contracts";
import { defineMessages } from "../../../i18n/messages";

/** 首页公开价格、计费单位和充值入口的文案。 */
export const landingPricingMessages = defineMessages({
  "zh-CN": {
    title: "积分包价格",
    description: `一次性充值，用于图片生成和编辑。每张图片消耗 ${imageUnitCredits} 积分。`,
    checkoutNote: "购买前可在结账页确认实际金额及适用税费。",
    signIn: "登录充值",
    topUp: "充值积分",
  },
  en: {
    title: "Credit pack pricing",
    description: `One-time credit packs for image generation and editing. Each image uses ${imageUnitCredits} credits.`,
    checkoutNote: "Review your final total and any applicable taxes at checkout.",
    signIn: "Sign in to top up",
    topUp: "Top up",
  },
});

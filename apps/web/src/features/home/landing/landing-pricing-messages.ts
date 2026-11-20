import { defineMessages } from "../../../i18n/messages";

/** 首页积分价格与支付待开放文案；只介绍一次性积分包，不承诺会员、赠送或有效期。 */
export const landingPricingMessages = defineMessages({
  "zh-CN": {
    pricingTitle: "充值积分，按需创作。",
    pricingDescription: "一次购买，用于主图、套图与家纺裂变。",
    pricingChoose: "选择积分数量",
    pricingCredits: "积分",
    pricingYield: "约可生成",
    pricingImages: "张图片",
    pricingEstimate: "按 {unit} 积分 / 张估算，不含 AI 优化等额外消耗。",
    pricingNoSubscription: "无需会员订阅",
    pricingConfirmCost: "生成前确认消耗",
    pricingOrder: "本次购买",
    pricingPayment: "USD · 一次性付款",
    pricingRate: "约 {price} / 积分",
    pricingBuy: "购买积分",
    pricingUnavailable: "在线支付即将开放",
  },
  en: {
    pricingTitle: "Top up. Create as you go.",
    pricingDescription: "One credit balance for hero images, image sets, and textile variations.",
    pricingChoose: "Choose your credits",
    pricingCredits: "credits",
    pricingYield: "Create approximately",
    pricingImages: "images",
    pricingEstimate:
      "Based on {unit} credits per image. AI optimization and other costs are extra.",
    pricingNoSubscription: "No subscription needed",
    pricingConfirmCost: "See the cost before generating",
    pricingOrder: "Your credit pack",
    pricingPayment: "USD · One-time payment",
    pricingRate: "Approx. {price} / credit",
    pricingBuy: "Buy credits",
    pricingUnavailable: "Online purchasing opens soon",
  },
});

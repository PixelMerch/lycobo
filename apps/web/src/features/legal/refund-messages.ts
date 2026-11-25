import { defineMessages } from "../../i18n/messages";
import { siteSupportEmail } from "../site/site-contact";
import type { LegalDocument } from "./legal-document";

const supportLink = { label: siteSupportEmail, href: `mailto:${siteSupportEmail}` };
const creemBuyerTerms = "https://www.creem.io/buyer-terms";

/** 积分购买退款规则，明确使用后的限制、人工核对及失败任务退回积分的区别。 */
export const refundMessages = defineMessages<LegalDocument>({
  "zh-CN": {
    title: "退款政策",
    updatedDate: "2026 年 11 月 25 日",
    intro: "了解如何申请积分购买退款，以及生成失败后积分如何退回。",
    sections: [
      {
        heading: "购买前确认",
        blocks: [
          "积分包为一次性购买。请在付款前核对结账页显示的积分数量、币种、最终金额及适用税费。",
        ],
      },
      {
        heading: "退款资格",
        blocks: [
          "一笔订单的积分全部未使用时，可提交退款申请。Lycobo 会核对付款、积分到账和使用记录后告知结果。",
          "在适用法律与结算条款允许的范围内，只要订单中的部分积分已使用，整笔订单通常不支持全额或部分退款。共享账户中的其他成员使用该笔积分，也计入使用记录。",
        ],
      },
      {
        heading: "如何申请退款",
        blocks: [
          "请联系下方客服邮箱，提供购买时使用的邮箱、订单号或收据编号，以及申请原因。审核期间请暂停使用该笔订单的积分。请勿发送完整银行卡号、密码或验证码。",
          supportLink,
          "通过 Creem 支付的订单由 Creem 按其买家条款处理退款，Lycobo 协助核对订单和积分记录。获批的款项通常退回原付款方式。退款完成后，该笔订单发放的对应积分会从到账账户收回。",
        ],
      },
      {
        heading: "生成失败与异常扣款",
        blocks: [
          "已扣费的生成任务确认失败后，对应积分会自动退回原扣款账户。个人账户和共享账户均适用。若一批图片只有部分生成失败，仅退回失败图片对应的积分。",
          "结果尚未确认的任务会保留待核对，避免自动重提或重复扣费。你可以在「积分明细」查看退回记录。",
          "如遇重复扣费、付款后积分未到账或未经授权的扣款，请联系客服，并附上相关任务编号或订单编号。",
        ],
      },
      {
        heading: "法定权利",
        blocks: [
          "本政策保留适用法律规定的强制性消费者权利，包括适用的撤回、退款及其他救济。通过 Creem 结算的订单还适用其买家条款。",
          { label: "Creem 买家条款", href: creemBuyerTerms },
        ],
      },
    ],
  },
  en: {
    title: "Refund Policy",
    updatedDate: "November 25, 2026",
    intro:
      "Learn how to request a refund for a credit purchase and how credits are returned when a generation fails.",
    sections: [
      {
        heading: "Before you pay",
        blocks: [
          "Credit packs are one-time purchases. Check the number of credits, currency, final amount, and any applicable taxes shown at checkout before you confirm payment.",
        ],
      },
      {
        heading: "Refund eligibility",
        blocks: [
          "You can request a refund if all credits from an order are unused. Lycobo will review the payment, credit delivery, and usage records and let you know the outcome.",
          "Where applicable law and the checkout terms allow, an order generally becomes ineligible for a full or partial refund once any of its credits are used. Credits used by other members of a shared account count toward that order’s usage.",
        ],
      },
      {
        heading: "How to request a refund",
        blocks: [
          "Email support with the email address used at checkout, the order or receipt number, and the reason for the request. Pause use of the credits from that order during review. Keep full card numbers, passwords, and verification codes private.",
          supportLink,
          "For orders paid through Creem, Creem handles refunds under its Buyer Terms. Lycobo helps verify the order and credit records. Approved refunds usually go back to the original payment method. Once the refund is complete, the corresponding credits are removed from the account that received them.",
        ],
      },
      {
        heading: "Failed tasks and payment issues",
        blocks: [
          "When a generation you were charged for is confirmed to have failed, its credits automatically go back to the account that was charged. This applies to both personal and shared accounts. If only part of a batch fails, credits are returned for the images that failed.",
          "Tasks with an unconfirmed result are held for review to prevent automatic resubmission or duplicate charges. You can check returned credits in Credit history.",
          "Contact support about duplicate charges, missing credits after payment, or unauthorized charges. Include the relevant task or order number.",
        ],
      },
      {
        heading: "Statutory rights",
        blocks: [
          "Mandatory consumer rights under applicable law still apply, including any applicable right of withdrawal, refund, or other remedy. Orders placed through Creem are also subject to its buyer terms.",
          { label: "Creem Buyer Terms", href: creemBuyerTerms },
        ],
      },
    ],
  },
});

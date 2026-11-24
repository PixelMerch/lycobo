import { defineMessages } from "../../i18n/messages";
import type { LegalDocument } from "./legal-document";

/** 积分购买退款规则，明确使用后的限制、人工核对及失败任务退回积分的区别。 */
export const refundMessages = defineMessages<LegalDocument>({
  "zh-CN": {
    title: "退款政策",
    updatedDate: "2026 年 11 月 24 日",
    effectiveDate: null,
    intro: "本政策适用于在 Lycobo 购买的积分。购买前，请确认所选积分数量、价格及使用规则。",
    sections: [
      {
        heading: "购买积分",
        blocks: [
          "积分用于支付 Lycobo 站内的图片生成等服务，购买数量与价格以支付前页面展示的信息为准。积分记入企业账户，由该企业的成员共用。",
          "本政策在积分购买功能开放时适用。是否可以购买，以站内实际开放的功能为准。",
        ],
      },
      {
        heading: "使用后不支持退款",
        blocks: [
          "该笔购买中的积分一经使用，该笔购买即不支持退款，包括其中尚未使用的剩余积分。",
          "例如，购买一包积分后，只要使用了其中一部分，就不能再就该笔购买申请全额或剩余积分对应金额的退款。企业成员使用共用积分，同样适用这一规则。",
        ],
      },
      {
        heading: "未使用积分的退款申请",
        blocks: [
          "如果该笔购买中的积分全部尚未使用，可以提交退款申请。申请需经人工审核，我们会核对购买订单、付款状态、积分到账及使用记录后告知处理结果。",
          "请提供购买账号、企业信息、订单号或付款凭证及申请原因，并通过站内客服渠道联系我们，或请企业管理员协助提交。请勿提供完整银行卡号、密码或验证码。",
          "提交申请不代表退款已获批准。审核期间请勿使用该笔购买的积分；审核通过后，我们会核销对应积分，并按原支付渠道的处理流程安排退款。",
        ],
      },
      {
        heading: "生成失败与异常扣款",
        blocks: [
          "生成明确失败的任务会按计费规则退回对应积分至企业账户。结果暂时无法确认的任务会保留待核对，避免重复提交或扣费。退回任务积分与退还购买款项分别处理。",
          "如遇重复扣款、付款后积分未到账或未经授权的交易，请联系我们核对。我们会根据订单和支付记录处理异常。",
        ],
      },
      {
        heading: "法定权利",
        blocks: [
          "本政策不限制适用法律规定的消费者强制性权利。法律要求退款或提供其他救济的，按相关法律规定处理。",
        ],
      },
    ],
  },
  en: {
    title: "Refund Policy",
    updatedDate: "November 24, 2026",
    effectiveDate: null,
    intro:
      "This policy applies to credits purchased on Lycobo. Before buying, check the credit quantity, price and usage rules shown at checkout.",
    sections: [
      {
        heading: "Credit purchases",
        blocks: [
          "Credits pay for image generation and other services within Lycobo. The quantity and price are shown before payment. Credits are added to the team account and shared by its members.",
          "This policy applies when credit purchases become available. Availability depends on the purchasing features currently offered on the site.",
        ],
      },
      {
        heading: "No refunds after use",
        blocks: [
          "Once any credits from a purchase have been used, that purchase is non-refundable, including its remaining unused credits.",
          "For example, using part of a credit pack makes that purchase ineligible for either a full refund or a refund for the unused balance. Use of shared credits by any team member is subject to the same rule.",
        ],
      },
      {
        heading: "Requests for unused purchases",
        blocks: [
          "If all credits from a purchase remain unused, you may submit a refund request for manual review. We will check the purchase, payment, credit delivery and usage records before communicating a decision.",
          "Provide your purchasing account, team details, order number or payment receipt, and the reason for your request. Contact us through the site's support channel, or ask your team administrator to help submit it. Do not send full card numbers, passwords or verification codes.",
          "Submitting a request does not guarantee approval. Do not use the credits while your request is under review. If approved, the corresponding credits will be removed and the refund arranged through the original payment channel's process.",
        ],
      },
      {
        heading: "Failed tasks and payment issues",
        blocks: [
          "Credits for tasks that clearly fail are returned to the team account under the billing rules. Tasks with an unconfirmed result remain under review to avoid duplicate submissions or charges. Task credit returns and purchase payment refunds are handled separately.",
          "Contact us about duplicate charges, missing credits after payment or unauthorized transactions. We will investigate using the order and payment records.",
        ],
      },
      {
        heading: "Statutory rights",
        blocks: [
          "This policy does not limit mandatory consumer rights under applicable law. Any refund or other remedy required by law will be handled accordingly.",
        ],
      },
    ],
  },
});

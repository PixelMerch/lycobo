import { defineMessages } from "../../i18n/messages";
import type { LegalDocument } from "./legal-document";
import { legalEntityMessages } from "./legal-entity-messages";

const zh = legalEntityMessages["zh-CN"];
const en = legalEntityMessages.en;

/**
 * 用户协议正文（2026-11-10 按产品现有功能起草，上线前须经法务审核）。
 * 只写已实现的行为；充值、会员等未开放的付费功能只说明“开放后按届时规则执行”。
 */
export const termsMessages = defineMessages<LegalDocument>({
  "zh-CN": {
    title: "用户协议",
    updatedDate: "2026 年 11 月 24 日",
    intro: `欢迎使用 Lycobo（以下简称“本服务”）。本服务由${zh.company}（以下简称“我们”）运营。本协议约定你与我们之间使用本服务的权利和义务，请在使用前仔细阅读。你登录或使用本服务，即表示已阅读并同意本协议；如不同意，请停止使用。`,
    sections: [
      {
        heading: "服务内容",
        blocks: [
          "Lycobo 是面向电商商家的 AI 商品图片创作工具，目前提供主图制作、家纺裂变、套图计划等功能，以及素材库、创作历史和企业积分账户。各项功能以页面实际开放的情况为准。",
          "生成结果由人工智能模型自动生成，可能存在不准确、不完整或与预期不符的情况。我们会持续改进，但不保证每次生成都能满足你的需求。",
          "我们可能根据业务需要调整、新增或下线部分功能，涉及重要变化时会在页面上提示。",
        ],
      },
      {
        heading: "账号与安全",
        blocks: [
          "目前通过企业账号登录。企业账号由你所在企业的管理员创建和管理；同一企业的成员共用企业积分，并可以查看本企业的创作记录、素材和积分明细。",
          "请妥善保管账号和密码，不要转借他人使用。发现账号被盗用或存在安全风险时，请立即修改密码并联系我们。因你自身保管不善造成的损失，由你自行承担。",
          "企业停用你的成员身份后，你将无法继续访问该企业的素材和积分。",
        ],
      },
      {
        heading: "积分与费用",
        blocks: [
          [
            "图片生成等功能按页面公示的价格扣除积分，提交前会显示所需积分。",
            "生成明确失败的任务会自动退回对应积分；结果暂时无法确认的任务会保留待核对，不会自动重新提交或重复扣费。",
            "积分属于企业账户，只能用于本服务，不能兑换现金，也不能转让给其他企业。",
            "购买积分的退款申请按本站退款政策处理。该笔购买中的积分一经使用，该笔购买即不支持退款，包括其中尚未使用的剩余积分；法律另有强制规定的除外。",
            "充值、会员订阅等付费功能开放后，按届时页面公示的规则执行。",
          ],
        ],
      },
      {
        heading: "你的内容",
        blocks: [
          "你上传的商品图、参考图，输入的提示词，以及据此生成的图片，统称“你的内容”。在法律允许的范围内，你的内容及相关权利归你或原权利人所有，我们不主张所有权。",
          "你应确保对上传的内容拥有合法权利或授权，不侵犯他人的知识产权、肖像权、隐私等合法权益。",
          "为提供服务，你授权我们在必要范围内存储和处理你的内容，并把提示词和参考图发送给提供生成能力的模型服务方。我们不会公开展示你的内容，也不会将其用于提供本服务以外的目的。",
          "生成内容可能与他人生成的内容相似。你在使用、发布生成内容前，应自行核对其准确性与合法性，并遵守电商平台规则及人工智能生成内容标识等相关规定。首页“创作灵感”中的示例图由 AI 生成，仅作展示，不代表真实客户的商品或作品。",
        ],
      },
      {
        heading: "使用规范",
        blocks: [
          "你不得利用本服务从事下列行为：",
          [
            "制作、上传或传播违反法律法规、侵犯他人合法权益的内容；",
            "生成虚假宣传、误导消费者的商品信息；",
            "使用爬虫、脚本等方式批量抓取数据或干扰服务正常运行，或试图绕过计费、权限与安全措施；",
            "对本服务进行反向工程，或未经许可转售、出租本服务。",
          ],
          "违反上述规范的，我们可以视情况删除相关内容、限制部分功能或停用账号，并依法保留追究责任的权利。",
        ],
      },
      {
        heading: "知识产权",
        blocks: [
          "本服务的软件、界面设计、商标和标识等知识产权归我们或相关权利人所有。除本协议明确允许的使用外，未经书面许可，不得复制、修改、传播或用于其他用途。",
        ],
      },
      {
        heading: "服务中断与责任限制",
        blocks: [
          "我们会尽力保持服务稳定可用，但可能因系统维护、网络故障、第三方服务异常或不可抗力出现中断或延迟。重要维护会尽量提前告知。",
          "在法律允许的范围内，我们不对因使用或无法使用本服务造成的间接损失承担责任；我们承担的赔偿总额，以你所在企业在损失发生前 12 个月内为本服务实际支付的费用为限。",
        ],
      },
      {
        heading: "协议变更与终止",
        blocks: [
          "我们可能修改本协议，修改后会在本页面更新并标注更新日期；重大变化会另行提示。修改生效后你继续使用本服务的，视为接受修改后的协议。",
          "你可以随时停止使用本服务。你违反本协议的，我们可以暂停或终止向你提供服务。",
        ],
      },
      {
        heading: "法律适用与争议解决",
        blocks: [
          `本协议适用中华人民共和国法律（不含港澳台地区法律）。因本协议产生的争议，双方应先友好协商；协商不成的，任一方可向${zh.court}有管辖权的人民法院提起诉讼。`,
        ],
      },
      {
        heading: "联系我们",
        blocks: [`如对本协议有任何疑问，请发送邮件至 ${zh.email}。`],
      },
    ],
  },
  en: {
    title: "Terms of Service",
    updatedDate: "November 24, 2026",
    intro: `Welcome to Lycobo (the "Service"). The Service is operated by ${en.company} ("we" or "us"). These terms set out your rights and obligations when you use the Service, so please read them carefully. By signing in to or using the Service, you agree to these terms. If you do not agree, please stop using the Service.`,
    sections: [
      {
        heading: "The Service",
        blocks: [
          "Lycobo is an AI product-image tool for e-commerce sellers. It currently offers main images, textile variations and image set plans, together with an asset library, creation history and a team credit account. Which features are available is as shown on the site.",
          "Results are generated automatically by AI models and may be inaccurate, incomplete or different from what you expect. We keep improving the Service but cannot guarantee that every result will meet your needs.",
          "We may change, add or retire features as the business requires and will flag important changes on the site.",
        ],
      },
      {
        heading: "Your account",
        blocks: [
          "You currently sign in with a team account, which your team's admin creates and manages. Members of the same team share its credits and can see its creation history, assets and credit records.",
          "Keep your account and password safe and do not let others use them. If your account is compromised or at risk, change your password right away and contact us. You are responsible for losses caused by not keeping your credentials safe.",
          "If your team removes you as a member, you lose access to its assets and credits.",
        ],
      },
      {
        heading: "Credits and fees",
        blocks: [
          [
            "Image generation and other features deduct credits at the prices shown on the site. You see the credits required before you submit.",
            "Credits for tasks that clearly fail are refunded automatically. Tasks whose result cannot be confirmed yet are held for review and are never resubmitted or charged again automatically.",
            "Credits belong to the team account, can only be used for the Service, and cannot be exchanged for cash or transferred to another team.",
            "Refund requests for purchased credits are governed by our Refund Policy. Once any credits from a purchase have been used, that purchase is non-refundable, including its remaining unused credits, except where mandatory law requires otherwise.",
            "Once paid features such as top-ups and memberships open, the rules shown on the site at that time apply.",
          ],
        ],
      },
      {
        heading: "Your content",
        blocks: [
          "Product photos and reference images you upload, prompts you enter and the images generated from them are your content. To the extent permitted by law, your content and the related rights belong to you or the original rights holder, and we do not claim ownership.",
          "You must have the rights or permission needed for everything you upload and must not infringe anyone's intellectual property, portrait, privacy or other lawful rights.",
          "To provide the Service, you allow us to store and process your content as needed and to send prompts and reference images to the model providers that generate the images. We do not display your content publicly or use it for anything other than providing the Service.",
          "Generated images may resemble images generated for others. Before you use or publish them, check that they are accurate and lawful and that they follow marketplace rules and any requirements for labeling AI-generated content. The samples in Inspiration on the home page are AI-generated for display only and are not real customers' products or work.",
        ],
      },
      {
        heading: "Acceptable use",
        blocks: [
          "You must not use the Service to:",
          [
            "create, upload or share content that breaks the law or infringes the lawful rights of others;",
            "generate false advertising or product information that misleads shoppers;",
            "scrape data in bulk with crawlers or scripts, disrupt the Service, or try to get around billing, permissions or security measures;",
            "reverse engineer the Service, or resell or rent it without permission.",
          ],
          "If you break these rules, we may remove the content, limit features or disable the account as appropriate, and we reserve our rights under the law.",
        ],
      },
      {
        heading: "Intellectual property",
        blocks: [
          "The software, interface design, trademarks and logos of the Service belong to us or the relevant rights holders. Except as these terms allow, you may not copy, modify, distribute or otherwise use them without written permission.",
        ],
      },
      {
        heading: "Availability and liability",
        blocks: [
          "We work to keep the Service stable, but it may be interrupted or delayed by maintenance, network failures, problems with third-party services or force majeure. We will try to announce major maintenance in advance.",
          "To the extent permitted by law, we are not liable for indirect losses arising from using or being unable to use the Service. Our total liability is limited to the fees your team actually paid for the Service in the 12 months before the loss.",
        ],
      },
      {
        heading: "Changes and termination",
        blocks: [
          "We may update these terms. Updates appear on this page with a new update date, and major changes are flagged separately. If you keep using the Service after an update takes effect, you accept the updated terms.",
          "You may stop using the Service at any time. If you break these terms, we may suspend or end your access.",
        ],
      },
      {
        heading: "Governing law and disputes",
        blocks: [
          `These terms are governed by the laws of the People's Republic of China (excluding Hong Kong, Macao and Taiwan). Both sides will first try to settle any dispute through negotiation. If that fails, either side may bring a claim before the competent people's court in ${en.court}.`,
        ],
      },
      {
        heading: "Contact us",
        blocks: [`If you have any questions about these terms, email us at ${en.email}.`],
      },
    ],
  },
});

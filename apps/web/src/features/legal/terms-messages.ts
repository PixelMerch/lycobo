import { defineMessages } from "../../i18n/messages";
import { siteSupportEmail } from "../site/site-contact";
import { type LegalDocument, legalPaths } from "./legal-document";

/** 用户协议说明独立创作服务、积分规则及可接受使用政策。 */
export const termsMessages = defineMessages<LegalDocument>({
  "zh-CN": {
    title: "用户协议",
    updatedDate: "2026 年 11 月 25 日",
    intro: "本协议适用于你访问和使用 Lycobo 商品图片创作服务。登录或使用服务即表示你同意本协议。",
    sections: [
      {
        heading: "服务内容",
        blocks: [
          "Lycobo 是面向电商商家的独立 AI 图片创作工具，通过第三方 AI 模型提供商品主图、套图计划、风格匹配和家纺多视角创作。第三方模型名称用于说明所接入的模型，Lycobo 不代表模型供应商，也未声称获得其背书。",
          "生成结果由人工智能模型自动生成，可能存在不准确、不完整或与预期不符的情况。我们会持续改进，但不保证每次生成都能满足你的需求。",
          "我们可能根据业务需要调整、新增或下线部分功能，涉及重要变化时会在页面上提示。",
        ],
      },
      {
        heading: "账号与安全",
        blocks: [
          "你可以使用页面上已开放的邮箱、Google、Apple 或企业账号登录。企业账号由工作区管理员管理。同一工作区成员按权限访问素材、创作记录和积分明细，并共用该工作区的积分余额。",
          "请妥善保管账号和密码，不要转借他人使用。发现账号被盗用或存在安全风险时，请立即修改密码并联系我们。因你自身保管不善造成的损失，由你自行承担。",
          "企业停用你的成员身份后，你将无法继续访问该企业的素材和积分。",
        ],
      },
      {
        heading: "积分与费用",
        blocks: [
          [
            "图片生成等功能按页面公示的价格扣除积分，提交前会显示所需积分。",
            "已扣费的生成任务确认失败后，对应积分会自动退回原扣款账户。结果尚未确认的任务会保留待核对，避免自动重提或重复扣费。",
            "积分用于 Lycobo 站内创作，记入购买账号所在工作区，不能兑换现金或转让给其他工作区。",
            "积分包为一次性购买，不自动续费。所含积分、币种、最终金额和适用税费以付款确认前的结账页为准。",
            "若订单通过 Creem 结算，Creem 作为该笔交易的名义销售方处理付款、适用税费、收据和退款。Lycobo 负责提供创作服务和处理积分到账问题。",
          ],
          { label: "查看退款政策", href: legalPaths.refunds },
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
        heading: "可接受使用政策",
        blocks: [
          "可将服务用于合法的商品图、场景图和详情图创作。上传素材、输入提示词、生成或编辑图片时，须遵守以下规则。",
          [
            "禁止色情、露骨性内容、性暗示内容及其他不适宜工作场合的内容（NSFW）。禁止生成包含未成年人形象的内容。",
            "禁止制作或传播有害内容，包括极端暴力、恐怖主义、鼓励自残、仇恨、骚扰及恶意冒用他人身份。禁止换脸、深度伪造或操纵真实人物的脸部形象。",
            "不得侵犯他人的知识产权、隐私或肖像权，不得制作欺诈内容或误导消费者的商品宣传。",
            "不得绕过内容审核、计费、权限或安全措施，也不得批量抓取数据或干扰服务运行。",
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
          "在适用法律允许的范围内，本协议适用中华人民共和国法律（不含港澳台地区法律）。争议可先通过客服协商，协商未果时可依法向有管辖权的法院提起诉讼。适用法律赋予你的强制性消费者权利继续适用。",
        ],
      },
      {
        heading: "联系我们",
        blocks: [
          "如对本协议、积分或创作服务有疑问，请联系 Lycobo 客服。",
          { label: siteSupportEmail, href: `mailto:${siteSupportEmail}` },
        ],
      },
    ],
  },
  en: {
    title: "Terms of Service",
    updatedDate: "November 25, 2026",
    intro:
      "These terms govern your use of Lycobo’s product-image creation service. By signing in or using the Service, you agree to these terms.",
    sections: [
      {
        heading: "The Service",
        blocks: [
          "Lycobo is an independent AI image tool for e-commerce sellers. It uses third-party models to create main images, image set plans, style matches, and textile variations. Model names identify integrations. Lycobo does not represent or claim endorsement by the model providers.",
          "Results are generated automatically by AI models and may be inaccurate, incomplete or different from what you expect. We keep improving the Service but cannot guarantee that every result will meet your needs.",
          "We may change, add or retire features as the business requires and will flag important changes on the site.",
        ],
      },
      {
        heading: "Your account",
        blocks: [
          "You can sign in with an email address, Google, Apple, or a team account where available. Workspace administrators manage team accounts. Members share the workspace credit balance and can access its assets, history, and credit activity according to their permissions.",
          "Keep your account and password safe and do not let others use them. If your account is compromised or at risk, change your password right away and contact us. You are responsible for losses caused by not keeping your credentials safe.",
          "If your team removes you as a member, you lose access to its assets and credits.",
        ],
      },
      {
        heading: "Credits and fees",
        blocks: [
          [
            "Image generation and other features deduct credits at the prices shown on the site. You see the credits required before you submit.",
            "When a paid generation is confirmed to have failed, its credits automatically go back to the account that was charged. Tasks with an unconfirmed result are held for review to prevent automatic resubmission or duplicate charges.",
            "Credits are added to the purchasing account’s workspace for use within Lycobo. They cannot be exchanged for cash or transferred to another workspace.",
            "Credit packs are one-time purchases and do not renew. Check the number of credits, currency, final amount, and any applicable taxes at checkout before you confirm payment.",
            "For orders placed through Creem, Creem acts as merchant of record and handles payment, applicable sales taxes, receipts, and refunds. Lycobo provides the creation service and helps with credit delivery issues.",
          ],
          { label: "Read the Refund Policy", href: legalPaths.refunds },
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
        heading: "Acceptable Use Policy",
        blocks: [
          "You may use Lycobo to create lawful product images, scenes, and detail shots. These rules apply to your uploads, prompts, generations, and edits.",
          [
            "Sexually explicit, sexually suggestive, and other not-safe-for-work (NSFW) content is prohibited. Do not generate content depicting minors.",
            "Harmful content is prohibited, including extreme violence, terrorism, encouragement of self-harm, hate, harassment, and deceptive impersonation. Do not create face swaps, deepfakes, or manipulated facial images of real people.",
            "Do not infringe intellectual property, privacy, or likeness rights, or create fraudulent content or product advertising that misleads shoppers.",
            "Do not bypass content moderation, billing, permissions, or security measures, scrape data in bulk, or disrupt the Service.",
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
          "To the extent permitted by applicable law, these terms are governed by the laws of the People’s Republic of China, excluding Hong Kong, Macao, and Taiwan. You may contact support to try to resolve a dispute and bring unresolved claims before a court with jurisdiction. Mandatory consumer rights under applicable law still apply.",
        ],
      },
      {
        heading: "Contact us",
        blocks: [
          "For questions about these terms, credits, or the creation service, contact Lycobo support.",
          { label: siteSupportEmail, href: `mailto:${siteSupportEmail}` },
        ],
      },
    ],
  },
});

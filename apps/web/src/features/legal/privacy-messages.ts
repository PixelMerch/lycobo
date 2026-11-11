import { defineMessages } from "../../i18n/messages";
import type { LegalDocument } from "./legal-document";
import { legalEntityMessages } from "./legal-entity-messages";

const zh = legalEntityMessages["zh-CN"];
const en = legalEntityMessages.en;

/**
 * 隐私政策正文（2026-11-10 按产品现有数据处理方式起草，上线前须经法务审核，
 * 尤其是跨境传输与单独同意的要求）。收集项、存储期限与安全措施以 docs 中的实现说明为准。
 */
export const privacyMessages = defineMessages<LegalDocument>({
  "zh-CN": {
    title: "隐私政策",
    intro: `${zh.company}（以下简称“我们”）重视你的个人信息保护。本政策说明你使用 Lycobo 时，我们如何收集、使用、存储、共享和保护你的个人信息，以及你享有的权利。`,
    sections: [
      {
        heading: "我们收集的信息",
        blocks: [
          [
            "账号信息：登录账号、用户编号（UID）、所在企业及角色、你选择的预设头像。密码只保存不可逆的哈希值，我们无法得知原文。",
            "创作内容：你上传的商品图和参考图、输入的提示词与生成参数、生成的图片以及任务记录。",
            "积分与订单记录：企业积分余额、每笔收支明细及对应的成员账号；充值功能开放后还包括充值订单。",
            "消息记录：任务结果通知、系统消息及你的已读状态。",
            "安全与运行信息：为保障安全、排查故障，我们会记录请求编号、请求时间和错误代码等必要信息，并以哈希形式记录登录尝试，用于防止密码被暴力猜测。我们不在日志中记录你的提示词、上传内容、密码或登录凭据。",
          ],
        ],
      },
      {
        heading: "我们如何使用信息",
        blocks: [
          [
            "提供登录、图片生成、素材保存、创作历史、积分计费和消息通知等功能；",
            "保障账号与服务安全，例如登录限流、会话校验和防止滥用；",
            "排查故障、核对计费结果和改进服务质量。",
          ],
          "如需将信息用于本政策未载明的其他目的，我们会事先征得你的同意。",
        ],
      },
      {
        heading: "Cookie 与浏览器本地存储",
        blocks: [
          "我们只使用保持登录所必需的 Cookie（会话与续期凭据，均设置为 HttpOnly，网页脚本无法读取），不用于广告或跨站跟踪。",
          "浏览器本地存储用于记住界面语言、最近使用的工具、通知偏好和尚未提交的创作草稿等。清除浏览器数据后，这些设置会恢复默认。我们没有在网页中接入第三方统计或广告追踪工具。",
        ],
      },
      {
        heading: "委托处理、共享与跨境传输",
        blocks: [
          [
            "模型服务：为生成图片和分析需求，我们会把你的提示词、参考图等发送给提供模型能力的服务方处理，并取回结果。",
            "云服务：本服务部署在 Cloudflare 的云平台上，数据库和对象存储由相应的云服务商提供。",
            "企业内共享：同一企业的成员可以查看本企业的创作记录、素材和积分明细；其他企业无法查看。",
          ],
          "上述服务方及其服务器可能位于中国境外，你的部分个人信息因此可能被传输至境外处理。我们要求服务方仅为提供服务处理数据，并采取必要的安全措施。",
          "除上述情形和法律法规要求外，我们不会向第三方出售、出租或共享你的个人信息。",
        ],
      },
      {
        heading: "存储期限",
        blocks: [
          [
            "上传后没有用于提交任务的图片暂存 3 天，到期后自动删除。",
            "提交任务后，参考图和生成的图片会长期保存在私有存储中，供你在素材库和创作历史中继续使用；查看图片需要校验身份和归属，并使用短期有效的链接。",
            "你注销账号或要求删除个人信息后，我们会在合理期限内删除或匿名化处理，法律法规另有规定的除外。",
          ],
        ],
      },
      {
        heading: "安全措施",
        blocks: [
          "我们通过加密传输、密码哈希存储、按企业和用户隔离数据、每次访问都校验身份与归属等措施保护你的信息。互联网环境无法做到绝对安全；如发生个人信息安全事件，我们会依法及时告知你并采取补救措施。",
        ],
      },
      {
        heading: "你的权利",
        blocks: [
          "你可以在账户设置中查看账号信息、修改密码、更换头像，也可以删除创作历史记录（已保存的素材仍会保留在素材库中）。",
          `你有权查阅、复制、更正、删除你的个人信息，撤回已作出的同意，或申请注销账号。如需行使这些权利，请发送邮件至 ${zh.email}，我们会在核验身份后 15 个工作日内答复。企业成员账号由企业管理员创建，部分请求可能需要企业管理员配合处理。`,
        ],
      },
      {
        heading: "未成年人保护",
        blocks: [
          "本服务面向企业和商家，不面向未满 14 周岁的未成年人。如发现在未经监护人同意的情况下收集了未满 14 周岁未成年人的个人信息，我们会尽快删除。",
        ],
      },
      {
        heading: "政策更新",
        blocks: [
          "我们可能适时更新本政策，更新后会在本页面标注更新日期；重大变化会通过站内消息等方式另行提示。",
        ],
      },
      {
        heading: "联系我们",
        blocks: [
          `运营主体：${zh.company}。如对本政策或个人信息处理有任何疑问、意见或投诉，请发送邮件至 ${zh.email}。`,
        ],
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    intro: `${en.company} ("we" or "us") takes the protection of your personal information seriously. This policy explains how we collect, use, store, share and protect your personal information when you use Lycobo, and the rights you have.`,
    sections: [
      {
        heading: "Information we collect",
        blocks: [
          [
            "Account details: your sign-in account, user ID (UID), team and role, and the preset avatar you choose. Passwords are stored only as one-way hashes, so we never know the original.",
            "Your creations: product photos and reference images you upload, the prompts and settings you enter, the images generated and the task records.",
            "Credits and orders: your team's credit balance and each transaction with the member account it belongs to, plus top-up orders once top-ups open.",
            "Messages: task result notifications, system messages and whether you have read them.",
            "Security and operations: to keep the Service secure and fix problems, we log essentials such as request IDs, times and error codes, and we record sign-in attempts in hashed form to block password guessing. We do not log your prompts, uploads, passwords or sign-in credentials.",
          ],
        ],
      },
      {
        heading: "How we use it",
        blocks: [
          [
            "To provide sign-in, image generation, asset storage, creation history, credit billing and notifications;",
            "To keep accounts and the Service secure, for example by limiting sign-in attempts, checking sessions and preventing abuse;",
            "To fix problems, check billing results and improve the Service.",
          ],
          "If we need to use your information for any purpose not described here, we will ask for your consent first.",
        ],
      },
      {
        heading: "Cookies and local storage",
        blocks: [
          "We only use the cookies needed to keep you signed in (session and renewal credentials, both HttpOnly so page scripts cannot read them). They are not used for advertising or cross-site tracking.",
          "Your browser's local storage remembers things like your language, recently used tools, notification preferences and drafts you have not submitted yet. Clearing your browser data resets them. Our pages do not include third-party analytics or ad tracking.",
        ],
      },
      {
        heading: "Processors, sharing and transfers abroad",
        blocks: [
          [
            "Model providers: to generate images and analyze requests, we send your prompts, reference images and similar inputs to the providers of the AI models and receive the results.",
            "Cloud services: the Service runs on Cloudflare's cloud platform, and the database and object storage are provided by the relevant cloud providers.",
            "Within your team: members of the same team can see its creation history, assets and credit records. Other teams cannot.",
          ],
          "These providers and their servers may be located outside mainland China, so some of your personal information may be transferred abroad for processing. We require them to process data only to provide the Service and to take the necessary security measures.",
          "Apart from the cases above and where the law requires it, we do not sell, rent or share your personal information with third parties.",
        ],
      },
      {
        heading: "How long we keep it",
        blocks: [
          [
            "Images you upload but never use in a submitted task are kept for 3 days and then deleted automatically.",
            "After you submit a task, its reference images and generated images are kept long term in private storage so you can keep using them in the asset library and creation history. Viewing them requires an identity and ownership check and uses short-lived links.",
            "When you close your account or ask us to delete your personal information, we delete or anonymize it within a reasonable time unless the law requires otherwise.",
          ],
        ],
      },
      {
        heading: "How we protect it",
        blocks: [
          "We protect your information with encrypted connections, hashed password storage, data separated by team and user, and identity and ownership checks on every access. No system on the internet is perfectly secure. If a personal information security incident happens, we will notify you promptly as the law requires and take remedial action.",
        ],
      },
      {
        heading: "Your rights",
        blocks: [
          "In account settings you can view your account details, change your password and change your avatar. You can also delete items from your creation history (saved assets stay in the asset library).",
          `You have the right to access, copy, correct and delete your personal information, withdraw consent you have given, or ask us to close your account. To exercise these rights, email ${en.email}. We will reply within 15 working days after verifying your identity. Team member accounts are created by your team's admin, so some requests may need the admin's help.`,
        ],
      },
      {
        heading: "Children",
        blocks: [
          "The Service is meant for businesses and sellers, not for children under 14. If we find that we have collected personal information from a child under 14 without a guardian's consent, we will delete it as soon as possible.",
        ],
      },
      {
        heading: "Updates to this policy",
        blocks: [
          "We may update this policy from time to time. Updates appear on this page with a new update date, and major changes are also announced through site messages or other means.",
        ],
      },
      {
        heading: "Contact us",
        blocks: [
          `Operator: ${en.company}. If you have any questions, comments or complaints about this policy or how we handle personal information, email us at ${en.email}.`,
        ],
      },
    ],
  },
});

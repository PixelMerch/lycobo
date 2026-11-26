import { defineMessages } from "../../i18n/messages";
import { siteSupportEmail } from "../site/site-contact";
import type { LegalDocument } from "./legal-document";

/** 说明 Lycobo 的数据处理和用户权利，发布前仍需确认主体、联系方式及跨境披露。 */
export const privacyMessages = defineMessages<LegalDocument>({
  "zh-CN": {
    title: "隐私政策",
    updatedDate: "2026 年 11 月 26 日",
    intro: "本政策说明 Lycobo 处理哪些个人信息、如何使用和保护这些信息，以及你如何行使自己的权利。",
    sections: [
      {
        heading: "我们收集的信息",
        blocks: [
          [
            "账号与登录。我们保存登录账号、Lycobo UID、昵称、头像和工作区角色。使用邮箱验证码时，我们处理你提供的邮箱。使用 Google 或 Apple 登录时，认证服务会向我们返回用于关联账号的身份标识、可用的邮箱和提供的姓名。我们可用该姓名填充昵称。企业账号密码仅以不可逆哈希保存。",
            "创作内容。我们处理你上传的商品图和参考图、提交的提示词、生成设置、结果图片和任务记录。",
            "账单与通知。我们记录工作区的积分余额、积分变动和关联任务或成员、已有的充值订单，以及任务和系统消息的已读状态。",
            "客服沟通。你联系 Lycobo 时，我们处理你的邮箱、来信内容及你提供的订单或任务信息，用于解决问题和跟进请求。",
            "安全与运行。我们记录必要的请求编号、时间和错误代码，并使用经哈希处理的标识来限制异常登录尝试。邮件验证码流程会使用连接地址防止滥用。运行日志不记录提示词、上传文件、密码或登录凭据。",
          ],
        ],
      },
      {
        heading: "我们为什么使用这些信息",
        blocks: [
          [
            "验证身份并管理账号、工作区权限和登录会话。Google 和 Apple 返回的身份信息用于登录、关联 Lycobo 账号及展示昵称。我们不会将这些身份信息作为图片生成输入。",
            "根据你的请求生成图像，提供素材库、创作历史、任务通知和积分明细。",
            "阻止滥用、处理故障、核对积分及协助处理你的请求。",
          ],
          "如需将个人信息用于本政策未列明的目的，我们会事先说明并征得你的同意。",
        ],
      },
      {
        heading: "Cookie 与浏览器存储",
        blocks: [
          "登录 Cookie 用于维持会话和续期。会话与续期凭据设为 HttpOnly，网页脚本无法读取。第三方登录时也会使用短期 Cookie，核对授权是否来自你发起的这次登录。",
          "浏览器存储可以记住语言、最近使用的工具、通知偏好及未提交的创作草稿。清除浏览器数据可能让你退出登录，并移除保存在这台设备上的设置和草稿。Lycobo 页面未接入第三方广告追踪或统计工具。",
        ],
      },
      {
        heading: "谁可以处理或访问这些信息",
        blocks: [
          [
            "登录服务。Google 或 Apple 完成授权后，Supabase Auth 帮助我们验证身份。使用邮箱验证码时，Supabase Auth 通过 Resend 发送邮件。Cloudflare Turnstile 用于防止自动化滥用。",
            "模型服务。为生成或编辑图片，所选服务方会处理该任务需要的提示词、设置和参考图。只需文字的规划或提示词优化流程可能只提交相关文本和参数。",
            "内容审核。我们在生成或编辑图片前，将用于任务的提示词和请求编号发送给 Creem，由其进行内容安全审核。",
            "云服务与工作区。Cloudflare 等基础设施服务商提供网站运行、存储与安全支持。在同一工作区内，有权限的成员可以访问工作区素材、任务记录和积分明细。",
          ],
          "通过 Creem 购买积分时，Creem 在结算页面处理付款、账单资料和适用税费。Lycobo 可收到用于核对订单、发放积分和处理售后的信息，例如订单号、买家邮箱、购买档位、金额、币种及付款状态。支付卡信息由结算服务处理。",
          { label: "Creem 隐私声明", href: "https://www.creem.io/privacy" },
          "部分服务商可能在中国大陆境外处理信息。在法律要求时，我们会在传输前告知你境外接收方、处理情况及行使权利的方式，并取得所需的单独同意。",
          "我们不出售或出租个人信息。除上文说明的情形外，我们只会在法律要求或允许的范围内披露相关信息。",
        ],
      },
      {
        heading: "信息保留多久",
        blocks: [
          [
            "仅在浏览器选择的本地图片用于预览。上传至服务器后，如图片未被已受理的任务引用，通常在上传满 3 天后过期，由后台清理。",
            "已受理任务使用的参考图和生成结果保存在私有存储中，以便在素材库和创作历史中继续使用。删除历史条目会把任务从历史列表中移除。已保存的素材、任务记录和账单记录仍会保留。",
            "账号、任务和账单信息按提供服务、解决争议和履行法定义务所需的期限保留。账号注销或删除请求获处理后，我们将在合理期限内删除或匿名化相关信息，法律要求继续保留的情况除外。",
          ],
        ],
      },
      {
        heading: "我们如何保护信息",
        blocks: [
          "我们使用加密连接、密码哈希、工作区权限校验和私有图片存储。访问图片时，系统会校验权限并使用短期有效的链接。发生涉及个人信息的安全事件时，我们会采取补救措施，并按法律要求通知你。",
        ],
      },
      {
        heading: "管理个人信息与行使权利",
        blocks: [
          "你可以在账户设置查看账号信息和修改昵称、头像。使用企业账号的用户可以修改密码。",
          `如需查阅、复制、更正、删除个人信息，撤回同意或申请注销账号，请发邮件至 ${siteSupportEmail}。我们会核验身份，并在核验后 15 个工作日内答复。企业成员的部分请求可能需要工作区管理员配合。`,
        ],
      },
      {
        heading: "未成年人保护",
        blocks: [
          "Lycobo 面向企业和商家，不面向未满 14 周岁的未成年人。如发现未经监护人同意收集了未满 14 周岁未成年人的个人信息，我们会尽快删除。",
        ],
      },
      {
        heading: "政策更新",
        blocks: [
          "我们会在此页面公布政策更新并注明更新日期。涉及个人权益的重大变化会通过站内消息等方式另行通知。",
        ],
      },
      {
        heading: "联系我们",
        blocks: [
          "如对隐私政策有疑问，或需要提交个人信息请求或投诉，请联系 Lycobo 客服。",
          { label: siteSupportEmail, href: `mailto:${siteSupportEmail}` },
        ],
      },
    ],
  },
  en: {
    title: "Privacy Policy",
    updatedDate: "November 26, 2026",
    intro:
      "This policy explains what personal information Lycobo handles, how we use and protect it, and how you can exercise your rights.",
    sections: [
      {
        heading: "Information we collect",
        blocks: [
          [
            "Account and sign-in. We store your sign-in account, Lycobo user ID, display name, avatar, and workspace role. For email sign-in, we process the email address you enter. When you sign in with Google or Apple, the authentication service returns an account identifier, an email address if available, and a name if provided. We may use that name as your display name. Team account passwords are stored as one-way hashes.",
            "Creation data. We process the product photos and references you upload, the prompts and settings you submit, the generated images, and task records.",
            "Billing and notifications. We record your workspace’s credit balance, credit transactions and their associated tasks or members, existing top-up orders, and read status for task and system messages.",
            "Support. When you contact Lycobo, we use your email address, message, and any order or task details you provide to investigate and respond.",
            "Security and operations. We record necessary request IDs, times, and error codes and use hashed identifiers to limit unusual sign-in attempts. Email verification uses your connection address to prevent abuse. Operational logs exclude prompts, uploads, passwords, and sign-in credentials.",
          ],
        ],
      },
      {
        heading: "Why we use this information",
        blocks: [
          [
            "To verify identity, manage accounts and workspace permissions, and maintain sessions. We use identity data from Google and Apple for sign-in, account linking, and display names. We do not use it as input for image generation.",
            "To generate images you request, provide the asset library and creation history, send task notifications, and show credit activity.",
            "To prevent abuse, troubleshoot, reconcile credits, and respond to requests.",
          ],
          "If we need to use personal information for a purpose outside this policy, we will explain the purpose and ask for your consent first.",
        ],
      },
      {
        heading: "Cookies and browser storage",
        blocks: [
          "Sign-in cookies maintain and renew your session. Session and renewal credentials are set to HttpOnly, which means page scripts cannot read them. We also use a short-lived cookie during third-party sign-in to verify that the authorization belongs to your request.",
          "Browser storage can remember your language, recently used tools, notification preferences, and unsubmitted drafts. Clearing browser data can sign you out and remove settings and drafts saved on that device. Lycobo pages do not include third-party analytics or ad tracking.",
        ],
      },
      {
        heading: "Who can process or access this information",
        blocks: [
          [
            "Sign-in services. Supabase Auth helps us verify identity after you authorize Google or Apple sign-in. For email codes, Supabase Auth sends the email through Resend. Cloudflare Turnstile helps prevent automated abuse.",
            "Model providers. When you generate or edit an image, the selected provider processes the prompts, settings, and reference images needed for that task. Text-only planning or prompt optimization may send only the relevant text and settings.",
            "Content moderation. Before generating or editing an image, Lycobo sends the prompts for that task and a request identifier to Creem for content safety screening.",
            "Cloud services and workspaces. Cloudflare and other infrastructure providers help operate, store, and secure the Service. Authorized workspace members can access workspace assets, tasks, and credit activity.",
          ],
          "When you buy credits through Creem, Creem handles payment, billing details, and applicable taxes at checkout. Lycobo may receive order information needed to verify payment, add credits, and provide support, such as the order ID, buyer email, pack, amount, currency, and payment status. The checkout service handles payment card data.",
          { label: "Creem Privacy Notice", href: "https://www.creem.io/privacy" },
          "Some providers may process information outside mainland China. Where required by law, we will tell you about the recipient, processing, and how to exercise your rights before the transfer, and obtain any separate consent required.",
          "We do not sell or rent personal information. Outside the situations described above, we disclose it only as required or permitted by law.",
        ],
      },
      {
        heading: "How long we keep information",
        blocks: [
          [
            "Images selected only in your browser are used for local preview. After upload, images that are not referenced by an accepted task generally expire after 3 days and are removed by background cleanup.",
            "Reference images used by accepted tasks and generated results stay in private storage for use in the asset library and creation history. Deleting a history entry removes the task from the history list. Saved assets, task records, and billing records are retained.",
            "We keep account, task, and billing information as needed to provide the Service, resolve disputes, and meet legal obligations. After we process an account closure or deletion request, we delete or anonymize the relevant information within a reasonable time, except where the law requires retention.",
          ],
        ],
      },
      {
        heading: "How we protect information",
        blocks: [
          "We use encrypted connections, password hashing, workspace permission checks, and private image storage. Image access is checked and uses short-lived links. If a personal information security incident occurs, we take remedial action and notify you as required by law.",
        ],
      },
      {
        heading: "Managing information and exercising your rights",
        blocks: [
          "In Account settings, you can view your account details and update your display name and avatar. Team account users can also change their password.",
          `To access, copy, correct, or delete your personal information, withdraw consent, or request account closure, email ${siteSupportEmail}. We verify your identity and respond within 15 working days after verification. Some requests from team members may need the workspace administrator’s assistance.`,
        ],
      },
      {
        heading: "Children",
        blocks: [
          "Lycobo is for businesses and sellers and is not directed at children under 14. If we find that we collected personal information from a child under 14 without a guardian’s consent, we will delete it as soon as possible.",
        ],
      },
      {
        heading: "Policy updates",
        blocks: [
          "We post updates here with their update date. If a change materially affects your rights, we will also notify you through an in-app message or another appropriate channel.",
        ],
      },
      {
        heading: "Contact us",
        blocks: [
          "For privacy questions, requests about your personal information, or complaints, contact Lycobo support.",
          { label: siteSupportEmail, href: `mailto:${siteSupportEmail}` },
        ],
      },
    ],
  },
});

import { defineMessages } from "../../i18n/messages";

/** 公共页脚的导航名称、分组标题与简短政策链接。 */
export const siteFooterMessages = defineMessages({
  "zh-CN": {
    navigation: "页脚导航",
    tools: "创作工具",
    workspace: "工作空间",
    resources: "资源",
    policies: "政策",
    faq: "常见问题",
    terms: "用户协议",
    privacy: "隐私政策",
    refunds: "退款政策",
    copyright: (year: number) => `© ${year} Lycobo`,
  },
  en: {
    navigation: "Footer navigation",
    tools: "Create",
    workspace: "Workspace",
    resources: "Resources",
    policies: "Policies",
    faq: "FAQ",
    terms: "Terms",
    privacy: "Privacy",
    refunds: "Refunds",
    copyright: (year: number) => `© ${year} Lycobo`,
  },
});

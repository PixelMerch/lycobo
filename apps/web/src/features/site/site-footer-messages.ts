import { defineMessages } from "../../i18n/messages";

/** 页脚分组、导航名称和版权文案。 */
export const siteFooterMessages = defineMessages({
  "zh-CN": {
    navigation: "页脚导航",
    tools: "创作工具",
    workspace: "工作空间",
    refundPolicy: "退款政策",
    socials: "社媒图标：X、YouTube、Instagram、TikTok",
    copyright: (year: number) => `© ${year} Lycobo`,
  },
  en: {
    navigation: "Footer navigation",
    tools: "Create",
    workspace: "Workspace",
    refundPolicy: "Refund policy",
    socials: "Social media logos: X, YouTube, Instagram, TikTok",
    copyright: (year: number) => `© ${year} Lycobo`,
  },
});

import { defineMessages } from "../../i18n/messages";

/** 页脚链接分组、社交平台名称与版权，法律名称复用对应文案。 */
export const siteFooterMessages = defineMessages({
  "zh-CN": {
    homeLink: "Lycobo 首页",
    navigation: "页脚导航",
    tools: "图片创作",
    space: "工作空间",
    socialMedia: "社交媒体",
    socialNames: { x: "X", youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok" },
    links: { workspace: "工作区", assets: "素材库", membership: "会员订阅" },
    copyright: (year: number) => `© ${year} Lycobo。保留所有权利。`,
  },
  en: {
    homeLink: "Lycobo home",
    navigation: "Footer navigation",
    tools: "Create images",
    space: "Your space",
    socialMedia: "Social media",
    socialNames: { x: "X", youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok" },
    links: { workspace: "Workspace", assets: "Assets", membership: "Membership" },
    copyright: (year) => `© ${year} Lycobo. All rights reserved.`,
  },
});

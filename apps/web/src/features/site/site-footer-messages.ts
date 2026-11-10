import { defineMessages } from "../../i18n/messages";

/** 站点页脚的文案：品牌定位、链接分组与版权；用户协议、隐私政策的名称在 legal-messages.ts。 */
export const siteFooterMessages = defineMessages({
  "zh-CN": {
    homeLink: "Lycobo 首页",
    tagline: "用一张商品图，做出整套上架图片",
    navigation: "页脚导航",
    tools: "电商工具",
    space: "工作空间",
    links: { workspace: "工作区", assets: "素材库", membership: "会员订阅" },
    copyright: (year: number) => `© ${year} Lycobo。保留所有权利。`,
  },
  en: {
    homeLink: "Lycobo home",
    tagline: "From one product photo to a full set of listing images",
    navigation: "Footer navigation",
    tools: "E-commerce tools",
    space: "Your space",
    links: { workspace: "Workspace", assets: "Assets", membership: "Membership" },
    copyright: (year) => `© ${year} Lycobo. All rights reserved.`,
  },
});

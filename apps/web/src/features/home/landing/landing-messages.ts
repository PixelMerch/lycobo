import { defineMessages } from "../../../i18n/messages";

/** 网站首页和电商专区的标题、创作框及商品案例文案。 */
export const landingMessages = defineMessages({
  "zh-CN": {
    home: {
      title: "让每件商品，都有一张好主图",
      description: "LYCOBO 商品视觉工作台。",
      enterCommerce: "探索电商专区",
      workspace: "进入工作区",
    },
    hero: {
      title: "一张普通商品图，做成精美卖点图",
      description: "用 LYCOBO 做出可上架的主图、场景图和细节图，让顾客一眼看懂商品卖点。",
    },
    composer: {
      start: "进入工作区",
      addMedia: "添加素材",
      product: "商品素材",
      replica: "复制爆款",
      settings: "图片规格",
      placeholder: "参考目标图风格，生成自己的商品图",
    },
    footer: {
      homeAria: "LYCOBO 首页",
      tagline: "为商品，做好每一张图",
      navAria: "页脚导航",
      copyright: "© 2026 Lycobo。保留所有权利。",
      socials: {
        wechat: "微信",
        discord: "Discord",
        instagram: "Instagram",
        youtube: "YouTube",
        tiktok: "TikTok",
        x: "X",
      },
      columns: {
        createImages: {
          title: "图片创作",
          links: {
            create: "主图制作",
            textile: "家纺裂变",
            variation: "套图计划",
            replica: "复制爆款",
          },
        },
        space: {
          title: "工作空间",
          links: { workspace: "工作区", assets: "素材库", inspiration: "灵感库" },
        },
        legal: {
          title: "法律",
          links: { terms: "用户协议", privacy: "隐私政策" },
        },
      },
    },
  },
  en: {
    home: {
      title: "Give every product a standout image",
      description: "The LYCOBO product imaging studio.",
      enterCommerce: "Explore e-commerce",
      workspace: "Open workspace",
    },
    hero: {
      title: "From a plain photo to a standout product image",
      description: "Create listing-ready main images, lifestyle shots, and close-ups with LYCOBO.",
    },
    composer: {
      start: "Open workspace",
      addMedia: "Add media",
      product: "Product assets",
      replica: "Style Match",
      settings: "Image settings",
      placeholder: "Reference the target style and create your own product image",
    },
    footer: {
      homeAria: "LYCOBO home",
      tagline: "Better images for your products",
      navAria: "Footer navigation",
      copyright: "© 2026 Lycobo. All rights reserved.",
      socials: {
        wechat: "WeChat",
        discord: "Discord",
        instagram: "Instagram",
        youtube: "YouTube",
        tiktok: "TikTok",
        x: "X",
      },
      columns: {
        createImages: {
          title: "Create images",
          links: {
            create: "Main Image",
            textile: "Textile Set",
            variation: "Image Set Planner",
            replica: "Style Match",
          },
        },
        space: {
          title: "Your space",
          links: { workspace: "Workspace", assets: "Assets", inspiration: "Inspiration" },
        },
        legal: {
          title: "Legal",
          links: { terms: "Terms of Service", privacy: "Privacy Policy" },
        },
      },
    },
  },
});

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
      tagline: "看见你的声音",
      navAria: "页脚导航",
      copyright: "© 2026 Lycobo。保留所有权利。",
      socials: {
        wechat: "欢迎加入微信社区",
        discord: "在 Discord 关注 Lycobo",
        instagram: "在 Instagram 关注 Lycobo",
        youtube: "在 YouTube 关注 Lycobo",
        tiktok: "在 TikTok 关注 Lycobo",
        x: "在 X 关注 Lycobo",
      },
      columns: [
        { title: "功能", links: ["音乐视频生成器", "技能", "CLI", "更新日志"] },
        { title: "资源", links: ["博客", "用户指南", "FAQ"] },
        {
          title: "法律",
          links: ["授权许可", "免责声明", "使用政策", "争议政策", "隐私政策", "服务条款"],
        },
      ],
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
      tagline: "See your voice",
      navAria: "Footer navigation",
      copyright: "© 2026 Lycobo. All rights reserved.",
      socials: {
        wechat: "Join the WeChat community",
        discord: "Follow Lycobo on Discord",
        instagram: "Follow Lycobo on Instagram",
        youtube: "Follow Lycobo on YouTube",
        tiktok: "Follow Lycobo on TikTok",
        x: "Follow Lycobo on X",
      },
      columns: [
        { title: "Features", links: ["Music video generator", "Skills", "CLI", "Changelog"] },
        { title: "Resources", links: ["Blog", "User guide", "FAQ"] },
        {
          title: "Legal",
          links: ["License", "Disclaimer", "Usage policy", "Dispute policy", "Privacy", "Terms"],
        },
      ],
    },
  },
});

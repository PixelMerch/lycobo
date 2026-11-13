import { defineMessages } from "../../../i18n/messages";

/** 首页首屏、输入框与页脚的中英文文案。 */
export const landingMessages = defineMessages({
  "zh-CN": {
    hero: {
      title: "一张普通商品图，做成精美卖点图",
      description: "用 LYCOBO 做出可上架的主图、场景图和细节图，让顾客一眼看懂商品卖点。",
      remixPrompt: (title: string, description: string) =>
        `复刻「${title}」广告风格：${description}`,
      addMedia: "添加媒体",
      videoChip: "视频重制",
      removeChip: "移除视频重制",
      removeFile: (name: string) => `移除 ${name}`,
      describe: "描述你的修改需求",
      placeholder: "上传要复刻的视频，并描述你的修改需求。",
      product: "产品详情",
      settings: "设置",
      create: "创建",
      ratio: "画面比例",
      ratioHint: (ratio: string) => `生成的广告会按 ${ratio} 画幅输出`,
      linkPlaceholder: "粘贴商品链接，例如 https://...",
      uploadProduct: "或上传产品图片",
      started: "已开始生成，预计 1 分钟完成",
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
    hero: {
      title: "From a plain photo to a standout product image",
      description:
        "Create listing-ready main images, lifestyle shots, and close-ups with LYCOBO. Show shoppers what makes your product worth buying.",
      remixPrompt: (title: string, description: string) =>
        `Recreate the "${title}" ad style: ${description}`,
      addMedia: "Add media",
      videoChip: "Video remake",
      removeChip: "Remove video remake",
      removeFile: (name: string) => `Remove ${name}`,
      describe: "Describe your changes",
      placeholder: "Upload the video to remake and describe your changes.",
      product: "Product details",
      settings: "Settings",
      create: "Create",
      ratio: "Aspect ratio",
      ratioHint: (ratio: string) => `The ad will be generated in ${ratio}`,
      linkPlaceholder: "Paste a product link, e.g. https://...",
      uploadProduct: "Or upload a product photo",
      started: "Generation started, about 1 minute to finish",
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

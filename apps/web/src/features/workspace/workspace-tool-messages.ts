import { defineMessages } from "../../i18n/messages";

/** 电商工具的通俗名称与一句话用途，供导航、参数区和示例预览共用。 */
export const workspaceToolMessages = defineMessages({
  "zh-CN": {
    toolBar: "电商创作工具",
    sampleBadge: "效果示例",
    usageGuide: (name: string) => `${name}使用说明`,
    mainImageExampleAlt: "雾青背景上的层叠作品卡片",
    workspaceViews: "工作区视图",
    createView: "创作",
    historyView: "历史记录",
    history: "工作区历史记录",
    restoreTitle: "载入这次创作？",
    restoreContent: "当前工具还有未提交的内容，载入后将替换该工具的草稿。",
    restore: "载入",
    historyHeading: "生成记录",
    pageScroll: "滚动工作区",
    collapseToolRail: "收起工具栏",
    expandToolRail: "展开工具栏",
    historyDensity: "历史视图",
    largeView: "大图",
    compactView: "紧凑",
    navigation: {
      productImages: "商品图片",
      categoryTools: "品类工具",
      listingImages: "上架用图",
      photography: "拍摄风格",
      textiles: "家纺",
      examples: "效果案例",
      tools: {
        create: "商品主图",
        variation: "商品套图",
        replica: "复制爆款",
        textile: "家纺套图",
      },
    },
    tools: {
      create: {
        name: "主图制作",
        summary: "一张商品照，做出上架好图",
      },
      textile: {
        name: "家纺裂变",
        summary: "一张家纺图，生成多角度和细节图",
      },
      variation: {
        name: "套图计划",
        summary: "先确认方案，再生成整套商品图",
      },
      replica: {
        name: "复制爆款",
        summary: "参考目标图风格，生成自己的商品图",
      },
      video: {
        name: "商品视频",
        summary: "视频功能暂未开放",
      },
    },
  },
  en: {
    toolBar: "E-commerce tools",
    sampleBadge: "Sample results",
    usageGuide: (name) => `How to use ${name}`,
    mainImageExampleAlt: "Layered artwork cards on a muted teal background",
    workspaceViews: "Workspace views",
    createView: "Create",
    historyView: "History",
    history: "Workspace history",
    restoreTitle: "Load this creation?",
    restoreContent: "This tool still has unsubmitted content. Loading replaces this tool's draft.",
    restore: "Load",
    historyHeading: "History",
    pageScroll: "Scroll workspace",
    collapseToolRail: "Collapse tools",
    expandToolRail: "Expand tools",
    historyDensity: "History view",
    largeView: "Large",
    compactView: "Compact",
    navigation: {
      productImages: "Product Images",
      categoryTools: "Category Tools",
      listingImages: "Listing Images",
      photography: "Photography Styles",
      textiles: "Home Textiles",
      examples: "Examples",
      tools: {
        create: "Product Main Image",
        variation: "Product Image Set",
        replica: "Style Match",
        textile: "Home Textile Image Set",
      },
    },
    tools: {
      create: {
        name: "Main Image",
        summary: "Turn a product photo into a listing hero",
      },
      textile: {
        name: "Textile Set",
        summary: "Create more angles and close-ups",
      },
      variation: {
        name: "Image Set Planner",
        summary: "Review the plan, then create the full set",
      },
      replica: {
        name: "Style Match",
        summary: "Give your product the look of a reference image",
      },
      video: {
        name: "Product Video",
        summary: "Video creation is not available yet",
      },
    },
  },
});

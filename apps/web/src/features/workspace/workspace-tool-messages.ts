import { defineMessages } from "../../i18n/messages";

/** 电商工具的名称与一句话用途，供导航和参数区共用。 */
export const workspaceToolMessages = defineMessages({
  "zh-CN": {
    toolBar: "电商创作工具",
    mainImageExampleAlt: "运动鞋广告示例，橙色跑鞋配 MOVE BOLD 大字",
    imageSetExampleAlt: "同一个紫色背包的商品主图、背负场景和拉链特写",
    styleMatchExampleAlt: "以蓝黄色音箱广告为风格参考，将橙色耳机原图做成同风格广告",
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
        summary: "用参考图的风格生成商品图",
      },
      video: {
        name: "商品视频",
        summary: "视频功能暂未开放",
      },
    },
  },
  en: {
    toolBar: "E-commerce tools",
    mainImageExampleAlt: "Running shoe campaign with an orange sneaker and the headline MOVE BOLD",
    imageSetExampleAlt:
      "Catalog photo, lifestyle photo and zipper close-up of the same purple backpack",
    styleMatchExampleAlt:
      "Orange headphones styled to match the blue-and-yellow lighting and composition of a speaker ad",
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
        summary: "Apply a reference style to your product",
      },
      video: {
        name: "Product Video",
        summary: "Video creation is not available yet",
      },
    },
  },
});

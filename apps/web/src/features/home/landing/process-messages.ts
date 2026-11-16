import { defineMessages } from "../../../i18n/messages";

/** 提供同款商品制作流程的中英文标题与步骤。 */
export const processMessages = defineMessages({
  "zh-CN": {
    title: "从原图到成片",
    stepsLabel: "商品图制作步骤",
    steps: [
      { title: "准备原图", description: "先用一张清楚的商品图，确定要保留的外观与结构。" },
      { title: "制作主图", description: "用干净背景和柔和布光，让顾客先看清整个商品。" },
      { title: "补齐场景", description: "给同款商品换上自然光和厨房台面，交代它在什么地方使用。" },
      { title: "放大细节", description: "选杯盖、挂绳等可见部位，用特写补足主图里看不清的细节。" },
    ],
  },
  en: {
    title: "From source photo to finished shots",
    stepsLabel: "Product image workflow",
    steps: [
      {
        title: "Start with a photo",
        description: "Use a clear photo to establish the shape and features to keep.",
      },
      {
        title: "Make a main image",
        description: "Use a clean backdrop and soft light to show the whole product.",
      },
      {
        title: "Set the scene",
        description: "Put the same product on a sunlit kitchen counter to show where it fits.",
      },
      {
        title: "Show the details",
        description:
          "Bring the lid and strap closer so shoppers can see what the main shot leaves small.",
      },
    ],
  },
});

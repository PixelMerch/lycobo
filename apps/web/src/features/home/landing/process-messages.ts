import { defineMessages } from "../../../i18n/messages";

/** 提供同款商品制作流程的中英文标题与步骤。 */
export const processMessages = defineMessages({
  "zh-CN": {
    title: "从原图到成片",
    stepsLabel: "商品图制作步骤",
    steps: ["准备原图", "制作主图", "补齐场景", "放大细节"],
  },
  en: {
    title: "From source photo to finished shots",
    stepsLabel: "Product image workflow",
    steps: ["Start with a photo", "Make a main image", "Set the scene", "Show the details"],
  },
});

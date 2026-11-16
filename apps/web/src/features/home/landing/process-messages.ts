import { defineMessages } from "../../../i18n/messages";

/** 提供商品图解与工作区流程的中英文文案。 */
export const processMessages = defineMessages({
  "zh-CN": {
    title: { lead: "一款商品，", continuation: "需要不止一张图" },
    frames: { original: "原图", main: "主图", scene: "场景", detail: "细节" },
    stepsLabel: "商品图制作流程",
    steps: ["准备商品图", "选择制作方式", "在工作区开始制作"],
  },
  en: {
    title: { lead: "One product needs", continuation: "more than one photo" },
    frames: { original: "Original", main: "Main image", scene: "Lifestyle", detail: "Detail" },
    stepsLabel: "Product image workflow",
    steps: ["Prepare a product photo", "Choose how to create", "Start in the workspace"],
  },
});

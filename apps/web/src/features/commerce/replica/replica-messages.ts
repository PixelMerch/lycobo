import { defineMessages } from "../../../i18n/messages";

/** 风格复制的上传分工、补充要求与生成说明。 */
export const replicaMessages = defineMessages({
  "zh-CN": {
    parameters: "复制爆款参数",
    target: "风格图",
    product: "参考图",
    prompt: "补充要求",
    placeholder: "例如：背景更简洁，保留商品标志，不添加文字",
    instruction:
      "参考目标图的构图、光线、色调与背景风格，为参考商品重新创作一张电商主图。目标图只提供风格，不复制其中的商品、品牌标志或文字；严格保留参考商品的外观、颜色、结构、纹理与已有文字。",
    generate: "生成同风格图片",
    summary: (count: number, credits: number) => `生成 ${count} 张 · 共 ${credits} 积分`,
    note: "按生成张数扣积分；效果取决于参考图片，不保证销量。",
  },
  en: {
    parameters: "Style Match settings",
    target: "Style image",
    product: "Reference images",
    prompt: "Extra requirements",
    placeholder: "For example: a simpler background, keep the product logo, add no text",
    instruction:
      "Create a new ecommerce product photo using the target image's composition, lighting, colors and background style. Use the target only for style; do not copy its product, brand marks or text. Preserve the reference product's appearance, colors, structure, texture and existing text.",
    generate: "Generate matching style",
    summary: (count: number, credits: number) => `${count} images · ${credits} credits`,
    note: "Credits are charged per image. Results depend on the references; sales are not guaranteed.",
  },
});

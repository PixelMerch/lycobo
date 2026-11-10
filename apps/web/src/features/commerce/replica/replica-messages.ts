import { defineMessages } from "../../../i18n/messages";

/** 风格复制的上传分工、补充要求与生成说明。 */
export const replicaMessages = defineMessages({
  "zh-CN": {
    parameters: "复制爆款参数",
    target: "目标图（想参考的风格）",
    targetHint: "借鉴这张图的构图、光线和背景，不复制其中的商品或文字",
    product: "参考图（你的商品）",
    productHint: "保留这张图中商品的外观、颜色和细节",
    prompt: "补充要求（选填）",
    placeholder: "例如：背景更简洁，保留商品标志，不添加文字",
    instruction:
      "参考目标图的构图、光线、色调与背景风格，为参考商品重新创作一张电商主图。目标图只提供风格，不复制其中的商品、品牌标志或文字；严格保留参考商品的外观、颜色、结构、纹理与已有文字。",
    generate: "生成同风格图片",
    note: "按生成张数扣积分；效果取决于参考图片，不保证销量。",
  },
  en: {
    parameters: "Style Match settings",
    target: "Target image · style",
    targetHint: "Borrow its composition, lighting and background, not its product or text",
    product: "Reference image · your product",
    productHint: "Keep this product's appearance, colors and details",
    prompt: "Extra requirements (optional)",
    placeholder: "For example: a simpler background, keep the product logo, add no text",
    instruction:
      "Create a new ecommerce product photo using the target image's composition, lighting, colors and background style. Use the target only for style; do not copy its product, brand marks or text. Preserve the reference product's appearance, colors, structure, texture and existing text.",
    generate: "Generate matching style",
    note: "Credits are charged per image. Results depend on the references; sales are not guaranteed.",
  },
});

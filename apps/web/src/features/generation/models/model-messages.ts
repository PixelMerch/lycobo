import { defineMessages } from "../../../i18n/messages";

/** 模型选择的文案与各模型的用途说明（按模型 id 查）；模型名称本身不翻译。 */
export const modelMessages = defineMessages({
  "zh-CN": {
    fallbackName: "图片创作",
    creationModel: "创作模型",
    model: "模型",
    models: {
      "gpt-image-2.6": { description: "商品图片生成与编辑", summary: "图文生成 · 参考图编辑" },
      "gpt-image-2": { description: "商品展示与日常图片编辑", summary: "图文生成 · 参考图编辑" },
      "gpt-image-2.5": { description: "商业摄影与创意海报", summary: "文字排版 · 写实画面" },
      "nano-banana-2.1": { description: "商品、人像与场景创作", summary: "场景生成 · 创意表达" },
      "gemini-3-pro-image-preview": {
        description: "商品细节与复杂画面创作",
        summary: "参考图编辑 · 创意表达",
      },
    },
  },
  en: {
    fallbackName: "Image creation",
    creationModel: "Creation model",
    model: "Model",
    models: {
      "gpt-image-2.6": {
        description: "Product image generation and editing",
        summary: "Text-to-image · Reference editing",
      },
      "gpt-image-2": {
        description: "Product showcases and everyday edits",
        summary: "Text-to-image · Reference editing",
      },
      "gpt-image-2.5": {
        description: "Commercial photography and creative posters",
        summary: "Typography · Photorealism",
      },
      "nano-banana-2.1": {
        description: "Products, portraits and scenes",
        summary: "Scene generation · Creative styles",
      },
      "gemini-3-pro-image-preview": {
        description: "Fine product details and complex scenes",
        summary: "Reference editing · Creative styles",
      },
    },
  },
});

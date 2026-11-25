import { defineMessages } from "../../i18n/messages";

/** 按已接通的工具维护中英文指南、操作步骤和结果说明。 */
export const creationGuideMessages = defineMessages({
  "zh-CN": {
    contents: "目录",
    intro: "按图片用途选择工具，查看操作步骤。",
    openTool: (name: string) => `打开${name}`,
    tools: {
      create: [
        "描述商品的背景、角度或光线。需要保留商品外观时，添加清晰的参考图。",
        "选好模型、比例和张数，查看所需积分后生成。",
      ],
      variation: [
        "说明需要哪些图片、各自的用途和卖点，按需添加商品参考图。",
        "生成方案后，逐张检查提示词和参考图。调整后勾选要生成的图片。",
      ],
      textile: [
        "上传一张家纺主图，按需补充花纹、纹理或包边的特写。",
        "勾选所需视角，例如正面、俯拍或面料特写，再生成。",
      ],
      replica: [
        "添加一张风格图，再添加自己的商品图。",
        "确认两类图片放在对应位置，按需补充要求，再生成。",
      ],
    },
    results: "查看和下载结果",
    resultSteps: [
      "在生成记录中查看进度。完成后打开预览，点击「下载原图」。",
      "部分失败时，已生成的图片仍可下载。确认失败的图片会退回相应积分，可按记录中的提示重试。",
    ],
  },
  en: {
    contents: "On this page",
    intro: "Choose a tool for the images you need and follow its steps.",
    openTool: (name: string) => `Open ${name}`,
    tools: {
      create: [
        "Describe the background, angle, or lighting. Add a clear reference photo to preserve the product’s appearance.",
        "Choose a model, aspect ratio, and image count. Check the credit cost, then generate.",
      ],
      variation: [
        "List the shots you need, where they’ll appear, and what they should highlight. Add product references as needed.",
        "Generate a plan. Review each shot’s prompt and references, make edits, then select the shots to generate.",
      ],
      textile: [
        "Upload one main textile photo. Add close-ups of the pattern, weave, or trim as needed.",
        "Select the views you need, such as front, overhead, or fabric detail, then generate.",
      ],
      replica: [
        "Add a style reference, then add your own product photos.",
        "Check that each image is in the right field. Add any specific instructions, then generate.",
      ],
    },
    results: "Review and download results",
    resultSteps: [
      "Check progress in generation history. Open a finished image and select Download original.",
      "If a batch partly fails, you can still download completed images. Credits are returned for confirmed failures. Retry from history when available.",
    ],
  },
});

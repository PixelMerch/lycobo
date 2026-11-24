import { defineMessages } from "../../i18n/messages";

/** 按已接通的工具维护中英文指南、操作步骤和结果说明。 */
export const creationGuideMessages = defineMessages({
  "zh-CN": {
    contents: "目录",
    intro: "选择适合的工具，从准备参考图到下载成品。",
    openTool: (name: string) => `打开${name}`,
    tools: {
      create: [
        "描述想要的商品画面，包括背景、角度或光线。需要保留商品外观时，添加清晰的商品参考图。",
        "选择模型、画幅和生成数量，确认所需积分后开始生成。",
      ],
      variation: [
        "描述整套图片的用途和卖点，如主图、场景图或细节图，按需添加商品参考图。",
        "生成套图方案，检查每张图的提示词和参考图。调整并勾选所需的方案后，再确认生成。",
      ],
      textile: [
        "上传一张家纺主图。需要表现花纹、纹理或包边时，可以再添加细节参考图。",
        "按用途勾选所需视角，例如正视、俯拍或面料特写，确认后生成。",
      ],
      replica: [
        "先添加一张想参考的版式图，再添加自己的商品图。",
        "检查版式图和商品图的角色，按需补充说明，再生成与参考风格一致的商品图。",
      ],
    },
    results: "查看和下载结果",
    resultSteps: [
      "在工具的生成记录里查看进度。生成后打开图片预览，使用下载入口保存原图。",
      "如果同组有图片失败，可以继续使用已生成的图片。明确失败的图片会退回对应积分，可在记录中按提示重试。",
    ],
  },
  en: {
    contents: "On this page",
    intro: "Choose the right tool, prepare your references, and download your finished images.",
    openTool: (name: string) => `Open ${name}`,
    tools: {
      create: [
        "Describe the shot you want, including the background, angle, or lighting. Add a clear product photo if you want to preserve its appearance.",
        "Choose a model, aspect ratio, and image count. Check the credit cost, then generate.",
      ],
      variation: [
        "Describe what the set needs to show and where the images will be used. Add product reference photos as needed.",
        "Generate a plan, then review the prompt and references for each shot. Edit the plan, select the shots you want, and confirm generation.",
      ],
      textile: [
        "Upload one main photo of the textile. Add close-ups if the pattern, weave, or trim matters to the result.",
        "Select the views you need, such as front, overhead, or fabric detail, then confirm generation.",
      ],
      replica: [
        "Add an image with the layout you want to use as a reference, then add your own product photos.",
        "Check which image is the layout reference and which photos show your products. Add any specific instructions, then generate.",
      ],
    },
    results: "Review and download results",
    resultSteps: [
      "Follow progress in the tool’s generation history. When an image is ready, open its preview and use Download to save the original.",
      "If part of a set fails, the completed images are still available. Credits are returned for confirmed failures. Follow the retry option in the history when available.",
    ],
  },
});

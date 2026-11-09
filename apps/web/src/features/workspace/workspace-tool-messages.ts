import { defineMessages } from "../../i18n/messages";

/** 四个电商工具的名称、一句话用途和三步用法（按工具 id 查），以及工具切换栏与预览卡的文案。 */
export const workspaceToolMessages = defineMessages({
  "zh-CN": {
    toolBar: "电商创作工具",
    sampleBadge: "示例效果",
    inUse: "正在使用",
    switchHint: "点击切换到此功能",
    usageGuide: (name: string) => `${name}使用说明`,
    tools: {
      create: {
        name: "主图制作",
        summary: "一张图讲清卖点：场景、白底、活动主图",
        steps: [
          "上传商品参考图（可选，最多 5 张）",
          "用提示词描述场景、白底或活动风格",
          "选好比例、分辨率与模型，点击生成",
        ],
      },
      textile: {
        name: "家纺裂变",
        summary: "一张主图，延展多视角与细节图",
        steps: [
          "上传 1 张家纺主图，可补充细节图",
          "在裂变类型里选择需要的视角",
          "选好比例与分辨率，一次生成整套",
        ],
      },
      variation: {
        name: "套图计划",
        summary: "先规划每张图，确认后批量生成",
        steps: [
          "上传商品参考图，描述整套图片的用途",
          "生成套图计划，逐张检查并修改提示词",
          "确认方案后批量生成",
        ],
      },
      video: {
        name: "视频创作",
        summary: "用文字和参考图片生成精美宣传视频",
        steps: [
          "添加参考图片，或直接输入文字描述",
          "描述画面主体、动作和镜头运动",
          "选择比例与5–30秒时长后生成",
        ],
      },
    },
  },
  en: {
    toolBar: "E-commerce tools",
    sampleBadge: "Sample results",
    inUse: "In use",
    switchHint: "Click to switch to this tool",
    usageGuide: (name) => `How to use ${name}`,
    tools: {
      create: {
        name: "Main Image",
        summary: "One image that sells: scene, white-background and campaign shots",
        steps: [
          "Upload product reference images (optional, up to 5)",
          "Describe the scene, white background or campaign style in a prompt",
          "Pick the aspect ratio, resolution and model, then generate",
        ],
      },
      textile: {
        name: "Textile Set",
        summary: "One main image, expanded into more angles and detail shots",
        steps: [
          "Upload 1 home textile main image, plus detail shots if you have them",
          "Choose the views you need under Variation types",
          "Pick the aspect ratio and resolution, then generate the whole set at once",
        ],
      },
      variation: {
        name: "Image Set Planner",
        summary: "Plan every image first, then generate the set once you confirm",
        steps: [
          "Upload product reference images and describe what the set is for",
          "Generate a plan, then check and edit each image's prompt",
          "Confirm the plan to generate every image in one batch",
        ],
      },
      video: {
        name: "Product Video",
        summary: "Turn text and reference images into polished promo videos",
        steps: [
          "Add reference images, or just type a description",
          "Describe the subject, the action and the camera movement",
          "Choose an aspect ratio and a 5–30 second length, then generate",
        ],
      },
    },
  },
});

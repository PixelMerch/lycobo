import { defineMessages } from "../../../i18n/messages";

/** 首页常见问题只说明已接通的创作流程与积分规则，不宣传会员或未开放的支付价格。 */
export const landingFaqMessages = defineMessages({
  "zh-CN": {
    faqTitle: "常见问题",
    faqPricingTitle: "充值积分，\n按次创作。",
    faqPricingDescription: "无需会员订阅。按需补充积分，创作前确认本次用量。",
    faqImagesQuestion: "需要准备什么样的商品图？",
    faqImagesAnswer:
      "选择清晰、主体完整的商品图。需要呈现面料、花型或局部细节时，可以补充对应的参考图。",
    faqToolsQuestion: "商品套图和家纺裂变有什么区别？",
    faqToolsAnswer:
      "商品套图根据你的用途规划主图、场景和细节图；家纺裂变围绕一款床品，按选定的俯拍、正面、面料特写等视角生成图片。",
    faqPlanQuestion: "可以先看方案，再生成图片吗？",
    faqPlanAnswer:
      "可以。商品套图会先生成计划，你可以修改每张图的提示词、调整参考图，再勾选需要的方案进行生成。",
    faqPromptQuestion: "不会写提示词，也能用吗？",
    faqPromptAnswer:
      "先用自己的话描述想要的画面，再使用 AI 优化补充构图、光线和商品呈现方式。优化后的文字可以继续编辑，也可以撤销。",
    faqCreditsQuestion: "创作时如何扣除积分？",
    faqCreditsAnswer:
      "提交前会显示本次所需积分。批量生成按选中的图片数量计算，AI 提示词优化单独确认消耗；实际扣费可以在积分明细中查看。",
    faqFailureQuestion: "生成失败，积分会退回吗？",
    faqFailureAnswer:
      "任务确认失败后，对应积分退回原钱包；多张图片部分失败时，只退回失败部分。结果仍在核对中的任务，请先查看任务状态与积分明细。",
  },
  en: {
    faqTitle: "Frequently asked\nquestions",
    faqPricingTitle: "Top up credits.\nCreate as you go.",
    faqPricingDescription:
      "No membership subscription. Add credits as needed and check the cost before each run.",
    faqImagesQuestion: "What kind of product photos should I upload?",
    faqImagesAnswer:
      "Use a clear photo with the whole product visible. Add reference images when you need to show fabric, patterns, or specific details.",
    faqToolsQuestion: "How are image sets different from textile variations?",
    faqToolsAnswer:
      "Image sets plan hero images, scenes, and details around your brief. Textile variations create selected views of the same bedding, such as overhead shots, front views, and fabric close-ups.",
    faqPlanQuestion: "Can I review the plan before generating?",
    faqPlanAnswer:
      "Yes. The image set planner creates a plan first. Edit each prompt, adjust its reference images, then select the images you want to generate.",
    faqPromptQuestion: "Do I need to know how to write prompts?",
    faqPromptAnswer:
      "Describe your idea in your own words. AI optimization adds composition, lighting, and product presentation details. You can keep editing the result or undo it.",
    faqCreditsQuestion: "How are credits charged?",
    faqCreditsAnswer:
      "The credit cost is shown before you submit. Batch generation counts the selected images, and AI prompt optimization has a separate cost confirmation. Check Credit history for actual charges.",
    faqFailureQuestion: "Are credits returned if generation fails?",
    faqFailureAnswer:
      "Once a task is confirmed failed, its credits return to the original wallet. If only some images fail, only those are refunded. For results still being checked, refer to the task status and Credit history.",
  },
});

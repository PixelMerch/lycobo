import { imageUnitCredits } from "@lycoboai/contracts";
import { defineMessages } from "../../../i18n/messages";

/** 首页问答覆盖创作准备、积分充值、任务退款和图片访问。 */
export const landingFaqMessages = defineMessages({
  "zh-CN": {
    faqTitle: "常见问题",
    faqToolsQuestion: "一张商品图能做出哪些效果？",
    faqToolsAnswer:
      "可以做主图、场景图和细节图，也能匹配参考图的风格。床品支持正面、俯拍和面料特写。",
    faqImagesQuestion: "上传什么样的商品图效果更好？",
    faqImagesAnswer: "选光线均匀、商品完整入镜的清晰照片。需要突出材质或花纹时，再补充特写。",
    faqPlanQuestion: "可以先看方案，再生成吗？",
    faqPlanAnswer: "套图计划会先列出每张图的提示词和参考图。你可以调整，再勾选要生成的图片。",
    faqCreditsQuestion: "一次生成要用多少积分？",
    faqCreditsAnswer: `每张图片消耗 ${imageUnitCredits} 积分，批量按张数计算。提示词优化单独显示费用。提交前可查看所需积分，扣费记录见「积分明细」。`,
    faqRechargeQuestion: "在哪里查看充值积分包？",
    faqRechargeAnswer: "生成时积分不足会打开充值弹框。也可点击顶栏「特惠充值」查看积分包和价格。",
    refundLink: "查看退款政策",
    faqFailureQuestion: "生成失败后，积分会退回吗？",
    faqFailureAnswer: "确认失败的图片会退回对应积分至原扣款账户。退款记录见「积分明细」。",
    faqPrivacyQuestion: "上传的图片谁能看到？",
    faqPrivacyAnswer:
      "图片私密存储，按工作区权限访问。提交生成时，模型服务方会处理相关提示词和参考图。",
    privacyLink: "查看隐私政策",
  },
  en: {
    faqTitle: "Frequently asked questions",
    faqToolsQuestion: "What can I create from one product photo?",
    faqToolsAnswer:
      "Create main images, lifestyle scenes, and close-ups, or match a reference style. Bedding supports front, overhead, and fabric detail views.",
    faqImagesQuestion: "What kind of product photo works best?",
    faqImagesAnswer:
      "Use a sharp, evenly lit photo of the whole product. Add a close-up for materials or patterns.",
    faqPlanQuestion: "Can I review and edit a plan before generating?",
    faqPlanAnswer:
      "The image set planner lists each shot with its prompt and references. Edit them, then select the shots to generate.",
    faqCreditsQuestion: "How many credits does a generation cost?",
    faqCreditsAnswer: `Each image costs ${imageUnitCredits} credits, including in batches. Prompt optimization shows its own cost. Check the total before submitting and the charge in Credit history.`,
    faqRechargeQuestion: "Where can I see the credit packs?",
    faqRechargeAnswer:
      "If you run out of credits when generating, the credit packs open. You can also select Top up in the header.",
    refundLink: "Read the Refund Policy",
    faqFailureQuestion: "Do I get my credits back if generation fails?",
    faqFailureAnswer:
      "Credits for confirmed failed images return to the account that was charged. See Credit history for the refund.",
    faqPrivacyQuestion: "Who can see the images I upload?",
    faqPrivacyAnswer:
      "Images are stored privately and restricted by workspace permissions. When you generate, the model provider processes the relevant prompts and reference images.",
    privacyLink: "Read the Privacy Policy",
  },
});

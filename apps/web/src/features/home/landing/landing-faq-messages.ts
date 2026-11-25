import { imageUnitCredits } from "@lycoboai/contracts";
import { defineMessages } from "../../../i18n/messages";

/** 首页问答覆盖创作准备、积分充值、任务退款和图片访问。 */
export const landingFaqMessages = defineMessages({
  "zh-CN": {
    faqTitle: "常见问题",
    faqToolsQuestion: "一张商品图能做出哪些效果？",
    faqToolsAnswer:
      "可以制作商品主图、场景图或细节图，也可以参考另一张图的风格。床品还有专门的多视角工具，可以选择俯拍、正面或面料特写。",
    faqImagesQuestion: "上传什么样的商品图效果更好？",
    faqImagesAnswer:
      "用光线均匀、商品完整入镜的清晰图片。需要突出花纹、材质或细节时，可以补充特写图。用自己的话描述想要的画面即可。",
    faqPlanQuestion: "可以先看方案，再生成吗？",
    faqPlanAnswer:
      "可以。商品套图会先列出预计生成的画面。你可以修改每张图的描述和参考图，只生成勾选的项目。",
    faqCreditsQuestion: "一次生成要用多少积分？",
    faqCreditsAnswer: `图片生成每张 ${imageUnitCredits} 积分，批量按所选张数计算。提示词 AI 优化单独显示费用。提交前可查看本次所需积分，实际扣费可在「积分明细」核对。`,
    faqRechargeQuestion: "在哪里查看充值积分包？",
    faqRechargeAnswer: "登录后点击顶栏积分余额旁的「特惠充值」，即可查看当前可选的积分包与价格。",
    refundLink: "查看退款政策",
    faqFailureQuestion: "生成失败后，积分会退回吗？",
    faqFailureAnswer:
      "已扣费的任务确认失败后，积分会退回原扣款账户。批量任务部分失败时，只退回失败图片对应的积分。你可以在「积分明细」核对。",
    faqPrivacyQuestion: "上传的图片谁能看到？",
    faqPrivacyAnswer:
      "图片保存在私有存储，按工作区和权限访问。提交生成后，相关提示词和参考图会交给该任务的模型服务方处理。",
    privacyLink: "查看隐私政策",
  },
  en: {
    faqTitle: "Frequently asked questions",
    faqToolsQuestion: "What can I create from one product photo?",
    faqToolsAnswer:
      "Make a main image, a lifestyle scene, or a detail shot. You can also match the look of a reference image. For bedding, choose views such as overhead, front, and fabric close-up.",
    faqImagesQuestion: "What kind of product photo works best?",
    faqImagesAnswer:
      "Start with a sharp, evenly lit photo that shows the whole product. Add a close-up if a pattern, material, or detail matters. Describe the result you want in your own words.",
    faqPlanQuestion: "Can I review and edit a plan before generating?",
    faqPlanAnswer:
      "Yes. The image set planner lists the proposed shots first. You can edit the description and references for each shot, then generate only the ones you select.",
    faqCreditsQuestion: "How many credits does a generation cost?",
    faqCreditsAnswer: `Image generation costs ${imageUnitCredits} credits per image. Batches are charged for the number you select. AI prompt optimization shows its own cost. You’ll see the total before submitting and can verify the charge in Credit history.`,
    faqRechargeQuestion: "Where can I see the credit packs?",
    faqRechargeAnswer:
      "Sign in and select Top up next to your credit balance to see the current packs and prices.",
    refundLink: "Read the Refund Policy",
    faqFailureQuestion: "Do I get my credits back if generation fails?",
    faqFailureAnswer:
      "If a task you were charged for is confirmed to have failed, the credits go back to the account that was charged. If only part of a batch fails, credits are returned for the images that failed. Check Credit history for the return.",
    faqPrivacyQuestion: "Who can see the images I upload?",
    faqPrivacyAnswer:
      "Images are kept in private storage, with access controlled by workspace and permissions. When you submit a generation, the model provider processes the relevant prompts and reference images.",
    privacyLink: "Read the Privacy Policy",
  },
});

import { defineMessages } from "../../i18n/messages";

/** 法律文本页面与页脚共用的文案：文本名称、切换导航与日期说明。 */
export const legalMessages = defineMessages({
  "zh-CN": {
    navigation: "协议与政策",
    contents: "本页目录",
    names: { terms: "用户协议", privacy: "隐私政策", refunds: "退款政策" },
    updated: (date: string) => `更新日期：${date}`,
    effective: (date: string) => `生效日期：${date}`,
  },
  en: {
    navigation: "Legal",
    contents: "On this page",
    names: { terms: "Terms of Service", privacy: "Privacy Policy", refunds: "Refund Policy" },
    updated: (date) => `Updated ${date}`,
    effective: (date) => `Effective ${date}`,
  },
});

import { defineMessages } from "../../i18n/messages";

/**
 * 运营主体信息：用户协议与隐私政策引用的公司全称、联系邮箱、生效日期与管辖法院只在这里填写。
 * 用户 2026-11-10 决定先起草，这几项仍是待补占位；上线前必须换成真实信息，两份文本须经法务审核。
 */
export const legalEntityMessages = defineMessages({
  "zh-CN": {
    company: "【待补：运营主体全称】",
    email: "【待补：联系邮箱】",
    court: "【待补：管辖法院所在地】",
    effectiveDate: "【待补：生效日期】",
    updatedDate: "2026 年 11 月 10 日",
  },
  en: {
    company: "[To be completed: operator's legal name]",
    email: "[To be completed: contact email]",
    court: "[To be completed: court location]",
    effectiveDate: "[To be completed: effective date]",
    updatedDate: "November 10, 2026",
  },
});

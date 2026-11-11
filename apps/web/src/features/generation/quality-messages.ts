import { defineMessages } from "../../i18n/messages";

/** 生成质量的标题与三个档位的名称，档位值与接口一致（low、medium、high）。 */
export const qualityMessages = defineMessages({
  "zh-CN": { title: "质量", levels: { low: "低", medium: "标准", high: "高" } },
  en: { title: "Quality", levels: { low: "Low", medium: "Standard", high: "High" } },
});

import { defineMessages } from "../../i18n/messages";

/** 页脚导航的名称与版权，协议名称由法律页面提供。 */
export const siteFooterMessages = defineMessages({
  "zh-CN": {
    navigation: "页脚导航",
    copyright: (year: number) => `© ${year} Lycobo`,
  },
  en: {
    navigation: "Footer navigation",
    copyright: (year: number) => `© ${year} Lycobo`,
  },
});

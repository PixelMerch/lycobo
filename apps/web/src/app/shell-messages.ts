import { defineMessages } from "../i18n/messages";

/** 应用外壳的文案：顶部栏、手机导航抽屉、语言菜单与整页提示。 */
export const shellMessages = defineMessages({
  "zh-CN": {
    home: "首页",
    commerce: "电商",
    commerceTools: "电商功能",
    assets: "素材库",
    mainNavigation: "主导航",
    openNavigation: "打开导航",
    closeNavigation: "关闭导航",
    language: (name: string) => `语言：${name}`,
    chooseLanguage: "选择语言",
    pageUnavailable: "页面暂时无法打开",
    pageNotFound: "页面不存在",
    backHome: "返回首页",
  },
  en: {
    home: "Home",
    commerce: "E-commerce",
    commerceTools: "E-commerce tools",
    assets: "Assets",
    mainNavigation: "Main navigation",
    openNavigation: "Open navigation",
    closeNavigation: "Close navigation",
    language: (name) => `Language: ${name}`,
    chooseLanguage: "Choose language",
    pageUnavailable: "This page can't be opened right now",
    pageNotFound: "Page not found",
    backHome: "Back to home",
  },
});

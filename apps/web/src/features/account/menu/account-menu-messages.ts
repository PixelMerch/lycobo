import { defineMessages } from "../../../i18n/messages";

/** 顶部栏账户入口的文案：登录胶囊、头像菜单与积分胶囊菜单。 */
export const accountMenuMessages = defineMessages({
  "zh-CN": {
    login: "登录领积分",
    accountMenu: (account: string) => `账户菜单：${account}`,
    usage: "积分明细",
    works: "个人作品",
    settings: "设置",
    logout: "退出登录",
    loggingOut: "正在退出…",
    creditsPill: (balance: string) => `积分 ${balance}`,
    creditsMenu: "积分",
    balance: "积分余额",
  },
  en: {
    login: "Sign in",
    accountMenu: (account) => `Account menu: ${account}`,
    usage: "Credit history",
    works: "My works",
    settings: "Settings",
    logout: "Sign out",
    loggingOut: "Signing out…",
    creditsPill: (balance) => `${balance} credits`,
    creditsMenu: "Credits",
    balance: "Credit balance",
  },
});

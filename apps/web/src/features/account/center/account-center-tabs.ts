/** 积分与账单弹窗的两个页签；账户菜单打开弹窗时指定其中之一。 */
export const accountCenterTabs = ["credits", "orders"] as const;

/** 积分与账单弹窗的页签 id。 */
export type AccountCenterTab = (typeof accountCenterTabs)[number];

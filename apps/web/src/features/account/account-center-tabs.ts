/** Account center tabs; the menu and the credit overview open the dialog on one of them. */
export const accountCenterTabs = [
  { id: "credits", label: "积分明细" },
  { id: "orders", label: "充值订单" },
  { id: "security", label: "账号与安全" },
] as const;

export type AccountCenterTab = (typeof accountCenterTabs)[number]["id"];

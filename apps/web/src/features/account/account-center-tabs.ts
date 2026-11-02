/** Account center tabs are routes, so links, refreshes and the back button keep the tab. */
export const accountCenterTabs = [
  { id: "overview", path: "", label: "概览" },
  { id: "credits", path: "credits", label: "积分明细" },
  { id: "orders", path: "orders", label: "充值订单" },
  { id: "membership", path: "membership", label: "会员" },
  { id: "security", path: "security", label: "账号与安全" },
] as const;

export type AccountCenterTab = (typeof accountCenterTabs)[number]["id"];

export function accountCenterPath(tab: AccountCenterTab) {
  const path = accountCenterTabs.find((item) => item.id === tab)?.path;
  return path ? `/account/${path}` : "/account";
}

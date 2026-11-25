/** 工作区入口及登录后页面的标准路径。 */
export const dashboardPath = "/dashboard";
export const dashboardToolPaths = {
  create: `${dashboardPath}/commerce/create`,
  textile: `${dashboardPath}/commerce/textile-set`,
  variation: `${dashboardPath}/commerce/smart-variation`,
  replica: `${dashboardPath}/commerce/replica`,
  video: `${dashboardPath}/video`,
} as const;
export const freeCanvasPath = `${dashboardPath}/free-canvas`;
export const dashboardAssetsPath = `${dashboardPath}/assets`;

export const dashboardPages = [
  ...Object.values(dashboardToolPaths),
  freeCanvasPath,
  dashboardAssetsPath,
];

/** 判断地址是否属于工作区，兼容末尾斜杠。 */
export function isDashboardPath(pathname: string) {
  const path = pathname.replace(/\/+$/, "");
  return path === dashboardPath || dashboardPages.some((page) => page === path);
}

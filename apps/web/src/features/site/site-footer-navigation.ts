import { shellMessages } from "../../app/shell-messages";
import type { Locale } from "../../i18n/locale";
import {
  dashboardAssetsPath,
  dashboardPath,
  dashboardToolPaths,
  freeCanvasPath,
} from "../../lib/dashboard-paths";
import { membershipMessages } from "../account/membership/membership-messages";
import { inspirationLibraryPath } from "../inspiration/inspiration-path";
import { legalDocumentIds, legalPaths } from "../legal/legal-document";
import { legalMessages } from "../legal/legal-messages";
import { workspaceToolMessages } from "../workspace/workspace-tool-messages";
import { siteFooterMessages } from "./site-footer-messages";

const toolIds = ["create", "variation", "replica", "textile"] as const;

/** 页脚指向用户提供的退款政策页面。 */
export const refundPolicyUrl = "https://bonko.fun/refund-policy";

/** 页脚显示的客服邮箱及其邮件链接使用同一个地址。 */
export const siteFooterSupportEmail = "suport@lycobo.com";
export const siteFooterSupportHref = `mailto:${siteFooterSupportEmail}`;

/** 为首页与站内页脚提供同一组可访问的功能和协议入口。 */
export function siteFooterGroups(locale: Locale) {
  const t = siteFooterMessages[locale];
  const shell = shellMessages[locale];
  const legal = legalMessages[locale];
  const { tools } = workspaceToolMessages[locale];
  return [
    {
      title: t.tools,
      links: toolIds.map((id) => ({ path: dashboardToolPaths[id], label: tools[id].name })),
    },
    {
      title: t.workspace,
      links: [
        { path: dashboardPath, label: shell.workspace },
        { path: inspirationLibraryPath, label: shell.inspiration },
        { path: freeCanvasPath, label: shell.freeCanvas },
        { path: dashboardAssetsPath, label: shell.assets },
        { path: "/membership", label: membershipMessages[locale].title },
      ],
    },
    {
      title: legal.navigation,
      links: [
        ...legalDocumentIds.map((id) => ({ path: legalPaths[id], label: legal.names[id] })),
        { path: refundPolicyUrl, label: t.refundPolicy },
      ],
    },
  ];
}

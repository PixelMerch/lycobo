import { shellMessages } from "../../app/shell-messages";
import type { Locale } from "../../i18n/locale";
import {
  dashboardAssetsPath,
  dashboardPath,
  dashboardToolPaths,
  freeCanvasPath,
} from "../../lib/dashboard-paths";
import { landingPricingPath } from "../home/landing/landing-pricing-navigation";
import { inspirationLibraryPath } from "../inspiration/inspiration-path";
import { legalPaths } from "../legal/legal-document";
import { workspaceToolMessages } from "../workspace/workspace-tool-messages";
import { siteFooterMessages } from "./site-footer-messages";

const toolIds = ["create", "variation", "textile", "replica"] as const;

/** 非首页的页脚通过带锚点的主页地址进入常见问题。 */
export const siteFooterFaqPath = "/#faq";

/** 首页、灵感库和协议页使用同一组双语入口。 */
export function siteFooterGroups(locale: Locale) {
  const t = siteFooterMessages[locale];
  const shell = shellMessages[locale];
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
        { path: freeCanvasPath, label: shell.freeCanvas },
        { path: dashboardAssetsPath, label: shell.assets },
      ],
    },
    {
      title: t.resources,
      links: [
        { path: inspirationLibraryPath, label: shell.inspiration },
        { path: landingPricingPath, label: shell.pricing },
        { path: siteFooterFaqPath, label: t.faq },
      ],
    },
    {
      title: t.policies,
      links: [
        { path: legalPaths.terms, label: t.terms },
        { path: legalPaths.privacy, label: t.privacy },
        { path: legalPaths.refunds, label: t.refunds },
      ],
    },
  ];
}

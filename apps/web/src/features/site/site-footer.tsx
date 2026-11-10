import { RouteLink } from "../../components/router-link";
import { useMessages } from "../../i18n/messages";
import { legalDocumentIds, legalPaths } from "../legal/legal-document";
import { legalMessages } from "../legal/legal-messages";
import { workspaceTools } from "../workspace/workspace-state";
import { workspaceToolMessages } from "../workspace/workspace-tool-messages";
import { siteFooterMessages } from "./site-footer-messages";
import "./site-footer.css";

/**
 * 站点页脚（参考 lumalabs.ai 的安静页脚）：细线下左边是品牌、定位与版权，右边三列不带标题的链接，
 * 依次是四个工具、工作空间、协议与政策。只链接本站真实页面；首页与法律文本页共用。
 */
export function SiteFooter() {
  const t = useMessages(siteFooterMessages);
  const legal = useMessages(legalMessages);
  const tools = useMessages(workspaceToolMessages).tools;
  // 三列没有可见标题，用 aria-label 给读屏一个分组名。
  const columns = [
    {
      label: t.tools,
      links: workspaceTools.map((tool) => ({ to: tool.path, label: tools[tool.id].name })),
    },
    {
      label: t.space,
      links: [
        { to: "/workspace", label: t.links.workspace },
        { to: "/assets", label: t.links.assets },
        { to: "/membership", label: t.links.membership },
      ],
    },
    {
      label: legal.navigation,
      links: legalDocumentIds.map((id) => ({ to: legalPaths[id], label: legal.names[id] })),
    },
  ];
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <RouteLink to="/" className="site-footer-logo" aria-label={t.homeLink}>
            <img src="/brand/lycobo-reveal.svg" alt="Lycobo" width="168" height="45" />
          </RouteLink>
          <p className="site-footer-tagline">{t.tagline}</p>
        </div>
        <nav className="site-footer-nav" aria-label={t.navigation}>
          {columns.map((column) => (
            <ul key={column.label} className="site-footer-column" aria-label={column.label}>
              {column.links.map((link) => (
                <li key={link.to}>
                  <RouteLink to={link.to} className="site-footer-link">
                    {link.label}
                  </RouteLink>
                </li>
              ))}
            </ul>
          ))}
        </nav>
        <p className="site-footer-copyright">{t.copyright(new Date().getFullYear())}</p>
      </div>
    </footer>
  );
}

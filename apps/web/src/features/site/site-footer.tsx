import { RouteLink } from "../../components/router-link";
import { useMessages } from "../../i18n/messages";
import { legalDocumentIds, legalPaths } from "../legal/legal-document";
import { legalMessages } from "../legal/legal-messages";
import { workspaceTools } from "../workspace/workspace-state";
import { workspaceToolMessages } from "../workspace/workspace-tool-messages";
import { siteFooterMessages } from "./site-footer-messages";
import "./site-footer.css";

/**
 * 站点页脚：品牌与一句定位、站内链接分组，底部版权与用户协议、隐私政策，最后一枚淡色大字标收尾。
 * 只链接本站真实存在的页面；首页与法律文本页共用。
 */
export function SiteFooter() {
  const t = useMessages(siteFooterMessages);
  const legal = useMessages(legalMessages);
  const tools = useMessages(workspaceToolMessages).tools;
  const linkGroups = [
    {
      title: t.tools,
      links: workspaceTools.map((tool) => ({ to: tool.path, label: tools[tool.id].name })),
    },
    {
      title: t.space,
      links: [
        { to: "/workspace", label: t.links.workspace },
        { to: "/assets", label: t.links.assets },
        { to: "/membership", label: t.links.membership },
      ],
    },
  ];
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-main">
          <div className="site-footer-brand">
            <RouteLink to="/" className="site-footer-logo" aria-label={t.homeLink}>
              <img src="/brand/lycobo-product-pilot.svg" alt="Lycobo" width="120" height="24" />
            </RouteLink>
            <p>{t.tagline}</p>
          </div>
          <nav className="site-footer-links" aria-label={t.navigation}>
            {linkGroups.map((group) => (
              <div key={group.title} className="site-footer-group">
                <h3>{group.title}</h3>
                {group.links.map((link) => (
                  <RouteLink key={link.to} to={link.to} className="site-footer-link">
                    {link.label}
                  </RouteLink>
                ))}
              </div>
            ))}
          </nav>
        </div>
        <div className="site-footer-bottom">
          <p>{t.copyright(new Date().getFullYear())}</p>
          <nav className="site-footer-legal" aria-label={legal.navigation}>
            {legalDocumentIds.map((id) => (
              <RouteLink key={id} to={legalPaths[id]} className="site-footer-link">
                {legal.names[id]}
              </RouteLink>
            ))}
          </nav>
        </div>
      </div>
      {/* 大字标只是装饰，读屏跳过。 */}
      <div className="site-footer-wordmark" aria-hidden="true" />
    </footer>
  );
}

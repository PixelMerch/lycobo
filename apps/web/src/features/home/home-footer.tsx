import { RouteLink } from "../../components/router-link";
import { useMessages } from "../../i18n/messages";
import { workspaceTools } from "../workspace/workspace-state";
import { workspaceToolMessages } from "../workspace/workspace-tool-messages";
import { homeMessages } from "./home-messages";

/**
 * 首页页脚（按 vidmuse 的版式）：左侧 Logo 与一句产品定位，右侧站内链接分组，底部版权行。
 * 只放本站真实存在的页面；没有社交账号、博客与法律页面，就不放对应入口。
 */
export function HomeFooter() {
  const t = useMessages(homeMessages);
  const tools = useMessages(workspaceToolMessages).tools;
  const linkGroups = [
    {
      title: t.footerTools,
      links: workspaceTools.map((tool) => ({ to: tool.path, label: tools[tool.id].name })),
    },
    {
      title: t.footerSpace,
      links: [
        { to: "/workspace", label: t.footerLinks.workspace },
        { to: "/assets", label: t.footerLinks.assets },
        { to: "/membership", label: t.footerLinks.membership },
      ],
    },
  ];
  return (
    <footer className="home-footer">
      <div className="home-footer-main">
        <div className="home-footer-brand">
          <RouteLink to="/" className="home-footer-logo" aria-label={t.homeLink}>
            <img src="/brand/lycobo-product-pilot.svg" alt="Lycobo" width="120" height="24" />
          </RouteLink>
          <p>{t.tagline}</p>
        </div>
        <nav className="home-footer-links" aria-label={t.footerNavigation}>
          {linkGroups.map((group) => (
            <div key={group.title} className="home-footer-group">
              <h3>{group.title}</h3>
              {group.links.map((link) => (
                <RouteLink key={link.to} to={link.to} className="home-footer-link">
                  {link.label}
                </RouteLink>
              ))}
            </div>
          ))}
        </nav>
      </div>
      <p className="home-footer-copyright">{t.copyright(new Date().getFullYear())}</p>
    </footer>
  );
}

import { RouteLink } from "../../components/router-link";
import { workspaceTools } from "../workspace/workspace-state";

const linkGroups = [
  {
    title: "电商工具",
    links: workspaceTools.map((tool) => ({ to: tool.path, label: tool.name })),
  },
  {
    title: "工作空间",
    links: [
      { to: "/workspace", label: "工作区" },
      { to: "/assets", label: "素材库" },
      { to: "/membership", label: "会员订阅" },
    ],
  },
];

/**
 * 首页页脚（按 vidmuse 的版式）：左侧 Logo 与一句产品定位，右侧站内链接分组，底部版权行。
 * 只放本站真实存在的页面；没有社交账号、博客与法律页面，就不放对应入口。
 */
export function HomeFooter() {
  return (
    <footer className="home-footer">
      <div className="home-footer-main">
        <div className="home-footer-brand">
          <RouteLink to="/" className="home-footer-logo" aria-label="Lycobo 首页">
            <img src="/brand/lycobo-product-pilot.svg" alt="Lycobo" width="120" height="24" />
          </RouteLink>
          <p>用一张商品图，做出整套上架图片</p>
        </div>
        <nav className="home-footer-links" aria-label="页脚导航">
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
      <p className="home-footer-copyright">© {new Date().getFullYear()} Lycobo。保留所有权利。</p>
    </footer>
  );
}

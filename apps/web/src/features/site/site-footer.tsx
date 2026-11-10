import { IconCamera, IconLayoutCollage, IconWand } from "@tabler/icons-react";
import { RouteLink } from "../../components/router-link";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { legalDocumentIds, legalPaths } from "../legal/legal-document";
import { legalMessages } from "../legal/legal-messages";
import { workspaceTools } from "../workspace/workspace-state";
import { workspaceToolMessages } from "../workspace/workspace-tool-messages";
import { siteFooterMessages } from "./site-footer-messages";
import { SiteFooterSocials } from "./site-footer-socials";
import "./site-footer.css";

const footerToolIcons = { create: IconCamera, textile: IconLayoutCollage, variation: IconWand };

/** 用品牌社交标识与三组真实入口收尾，首页和法律文本页共用。 */
export function SiteFooter() {
  const t = useMessages(siteFooterMessages);
  const legal = useMessages(legalMessages);
  const tools = useMessages(workspaceToolMessages).tools;
  const columns = [
    {
      label: t.tools,
      // 视频尚未接入生产运行时，页脚只展示当前可用的图片创作入口。
      links: workspaceTools
        .filter((tool) => tool.id !== "video")
        .map((tool) => ({
          to: tool.path,
          label: tools[tool.id].name,
          icon: footerToolIcons[tool.id],
        })),
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
          <SiteFooterSocials />
        </div>
        <nav className="site-footer-nav" aria-label={t.navigation}>
          {columns.map((column) => (
            <section key={column.label} className="site-footer-column" aria-label={column.label}>
              <h2 className="site-footer-heading">{column.label}</h2>
              <ul className="site-footer-links">
                {column.links.map((link) => (
                  <li key={link.to}>
                    <RouteLink to={link.to} className="site-footer-link">
                      {"icon" in link && <UiIcon icon={link.icon} size="default" />}
                      {link.label}
                    </RouteLink>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
        <p className="site-footer-copyright">{t.copyright(new Date().getFullYear())}</p>
      </div>
    </footer>
  );
}

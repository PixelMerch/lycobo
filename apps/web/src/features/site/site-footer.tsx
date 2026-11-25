import { RouteLink } from "../../components/router-link";
import { useLocale } from "../../i18n/locale-store";
import { useMessages } from "../../i18n/messages";
import { siteFooterMessages } from "./site-footer-messages";
import { siteFooterGroups } from "./site-footer-navigation";
import "./site-footer.css";

const wordmark = { src: "/brand/lycobo-footer-wordmark.svg", width: 429, height: 108 };

/** 首页、灵感库和协议页使用公共页脚布局，站内链接沿用本地化路由。 */
export function SiteFooter() {
  const t = useMessages(siteFooterMessages);
  const groups = siteFooterGroups(useLocale());
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-identity">
          <img className="site-footer-brand" {...wordmark} alt="Lycobo" />
          <p>{t.copyright(new Date().getFullYear())}</p>
        </div>
        <nav className="site-footer-groups" aria-label={t.navigation}>
          {groups.map(({ title, links }) => (
            <div className="site-footer-group" key={title}>
              <h2>{title}</h2>
              <ul>
                {links.map(({ path, label }) => (
                  <li key={path}>
                    <RouteLink to={path}>{label}</RouteLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="site-footer-signature" aria-hidden="true">
          <img {...wordmark} alt="" />
        </div>
      </div>
    </footer>
  );
}

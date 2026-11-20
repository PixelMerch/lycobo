import { Link } from "@heroui/react";
import { RouteLink } from "../../components/router-link";
import { useLocale } from "../../i18n/locale-store";
import { useMessages } from "../../i18n/messages";
import { siteFooterMessages } from "./site-footer-messages";
import {
  refundPolicyUrl,
  siteFooterGroups,
  siteFooterSupportEmail,
  siteFooterSupportHref,
} from "./site-footer-navigation";
import "./site-footer.css";

/** 页面底部共用品牌字标、分组入口与版权行。 */
export function SiteFooter() {
  const t = useMessages(siteFooterMessages);
  const groups = siteFooterGroups(useLocale());
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-main">
          <div>
            <img
              className="site-footer-brand"
              src="/brand/lycobo-footer-wordmark.svg"
              alt=""
              width={429}
              height={108}
            />
            <img
              className="site-footer-socials"
              src="/brand/lycobo-footer-socials.svg"
              alt={t.socials}
              width={116}
              height={20}
            />
          </div>
          <nav className="site-footer-nav" aria-label={t.navigation}>
            {groups.map(({ title, links }) => (
              <div key={title}>
                <h2>{title}</h2>
                <ul className="site-footer-links">
                  {links.map(({ path, label }) => (
                    <li key={path}>
                      {path === refundPolicyUrl ? (
                        <Link href={path}>{label}</Link>
                      ) : (
                        <RouteLink to={path}>{label}</RouteLink>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="site-footer-meta">
          <p>{t.copyright(new Date().getFullYear())}</p>
          <Link href={siteFooterSupportHref}>{siteFooterSupportEmail}</Link>
        </div>
        <img
          className="site-footer-wordmark"
          src="/brand/lycobo-footer-wordmark.svg"
          alt="Lycobo"
          width={429}
          height={108}
        />
      </div>
    </footer>
  );
}

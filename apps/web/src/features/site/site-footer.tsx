import { RouteLink } from "../../components/router-link";
import { useMessages } from "../../i18n/messages";
import { legalDocumentIds, legalPaths } from "../legal/legal-document";
import { legalMessages } from "../legal/legal-messages";
import { siteFooterMessages } from "./site-footer-messages";
import "./site-footer.css";

/** 页面底部共用协议入口、版权与品牌字标。 */
export function SiteFooter() {
  const t = useMessages(siteFooterMessages);
  const legal = useMessages(legalMessages);
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-meta">
          <nav className="site-footer-links" aria-label={t.navigation}>
            {legalDocumentIds.map((id) => (
              <RouteLink key={id} to={legalPaths[id]}>
                {legal.names[id]}
              </RouteLink>
            ))}
          </nav>
          <p className="site-footer-copyright">{t.copyright(new Date().getFullYear())}</p>
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

import { Button } from "@heroui/react";
import { RouteLink } from "../../../components/router-link";
import { useMessages } from "../../../i18n/messages";
import { useOpenAssetLibrary } from "../../assets/asset-library-store";
import { useRequireLogin } from "../../auth/login-prompt";
import { commerceTools } from "../../commerce/commerce-tools";
import { legalPaths } from "../../legal/legal-document";
import { inspirationLibraryPath } from "../inspiration-path";
import { BrandLogo } from "./brand-logo";
import { landingMessages } from "./landing-messages";

const toolHref = (id: "create" | "textile" | "variation" | "replica") =>
  commerceTools.find((tool) => tool.id === id)?.href ?? "/commerce";

/** 电商专区页脚：品牌与真实工具、空间及法律入口，省略未配置的社交账号。 */
export function SiteFooter() {
  const t = useMessages(landingMessages).footer;
  const requireLogin = useRequireLogin();
  const openLibrary = useOpenAssetLibrary();
  const links = t.columns;
  return (
    <footer className="commerce-footer">
      <div className="commerce-footer-inner">
        <div className="commerce-footerGrid">
          <div className="commerce-footerBrand">
            <p>{t.tagline}</p>
          </div>

          <nav aria-label={t.navAria} className="commerce-footerNav">
            <div>
              <h3>{links.createImages.title}</h3>
              <RouteLink to={toolHref("create")}>{links.createImages.links.create}</RouteLink>
              <RouteLink to={toolHref("textile")}>{links.createImages.links.textile}</RouteLink>
              <RouteLink to={toolHref("variation")}>{links.createImages.links.variation}</RouteLink>
              <RouteLink to={toolHref("replica")}>{links.createImages.links.replica}</RouteLink>
            </div>
            <div>
              <h3>{links.space.title}</h3>
              <RouteLink to="/workspace">{links.space.links.workspace}</RouteLink>
              <Button
                className="commerce-footerLink"
                variant="ghost"
                onPress={() => {
                  if (!requireLogin()) return;
                  openLibrary();
                }}
              >
                {links.space.links.assets}
              </Button>
              <RouteLink to={inspirationLibraryPath}>{links.space.links.inspiration}</RouteLink>
            </div>
            <div>
              <h3>{links.legal.title}</h3>
              <RouteLink to={legalPaths.terms}>{links.legal.links.terms}</RouteLink>
              <RouteLink to={legalPaths.privacy}>{links.legal.links.privacy}</RouteLink>
            </div>
          </nav>
        </div>

        <RouteLink aria-label={t.homeAria} className="commerce-footerBrandLink" to="/">
          <BrandLogo className="commerce-footerLogo" title={t.homeAria} />
        </RouteLink>

        <div className="commerce-footerBottom">
          <p>{t.copyright}</p>
        </div>
      </div>
    </footer>
  );
}

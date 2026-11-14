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

const socials = [
  { id: "wechat", icon: "/landing/social-wechat.svg" },
  { id: "discord", icon: "/landing/social-discord.svg" },
  { id: "instagram", icon: "/landing/social-instagram.svg" },
  { id: "youtube", icon: "/landing/social-youtube.svg" },
  { id: "tiktok", icon: "/landing/social-tiktok.svg" },
  { id: "x", icon: "/landing/social-x.svg" },
] as const;

const toolHref = (id: "create" | "textile" | "variation" | "replica") =>
  commerceTools.find((tool) => tool.id === id)?.href ?? "/commerce";

/** 电商专区页脚：真实工具、空间与法律入口，未配置的社交项只作静态标识。 */
export function SiteFooter() {
  const t = useMessages(landingMessages).footer;
  const requireLogin = useRequireLogin();
  const openLibrary = useOpenAssetLibrary();
  const links = t.columns;
  return (
    <footer className="lp-footer">
      <div className="lp-footer-inner">
        <div className="lp-footerGrid">
          <div className="lp-footerBrand">
            <RouteLink aria-label={t.homeAria} className="lp-footerBrandLink" to="/">
              <BrandLogo className="lp-footerLogo" title={t.homeAria} />
            </RouteLink>
            <p>{t.tagline}</p>
            <div className="lp-socials">
              {socials.map((social) => (
                <span
                  aria-label={t.socials[social.id]}
                  className="lp-socialMark"
                  key={social.id}
                  role="img"
                >
                  <img alt="" src={social.icon} />
                </span>
              ))}
            </div>
          </div>

          <nav aria-label={t.navAria} className="lp-footerNav">
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
                className="lp-footerLink"
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

        <div className="lp-footerBottom">
          <p>{t.copyright}</p>
        </div>
      </div>
    </footer>
  );
}

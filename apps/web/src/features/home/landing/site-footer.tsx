import { Link } from "@heroui/react";
import { useMessages } from "../../../i18n/messages";
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

/** 首页复刻页脚：品牌、社交入口、三组导航与版权。 */
export function SiteFooter() {
  const t = useMessages(landingMessages).footer;
  return (
    <footer className="lp-footer">
      <div className="lp-footer-inner">
        <div className="lp-footerGrid">
          <div className="lp-footerBrand">
            <Link aria-label={t.homeAria} href="#top">
              <BrandLogo className="lp-footerLogo" title={t.homeAria} />
            </Link>
            <p>{t.tagline}</p>
            <div className="lp-socials">
              {socials.map((social) => (
                <Link aria-label={t.socials[social.id]} href="#" key={social.id}>
                  <img alt="" src={social.icon} />
                </Link>
              ))}
            </div>
          </div>

          <nav aria-label={t.navAria} className="lp-footerNav">
            {t.columns.map((column) => (
              <div key={column.title}>
                <h3>{column.title}</h3>
                {column.links.map((item) => (
                  <Link href="#" key={item}>
                    {item}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </div>

        <div className="lp-footerBottom">
          <p>{t.copyright}</p>
        </div>
      </div>
    </footer>
  );
}

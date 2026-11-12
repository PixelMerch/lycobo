import { Link } from "@heroui/react";
import { useMessages } from "../../../i18n/messages";
import { BrandLogo } from "./brand-logo";
import { vidmuseMessages } from "./vidmuse-messages";

const socials = [
  { id: "wechat", icon: "/vidmuse/social-wechat.svg" },
  { id: "discord", icon: "/vidmuse/social-discord.svg" },
  { id: "instagram", icon: "/vidmuse/social-instagram.svg" },
  { id: "youtube", icon: "/vidmuse/social-youtube.svg" },
  { id: "tiktok", icon: "/vidmuse/social-tiktok.svg" },
  { id: "x", icon: "/vidmuse/social-x.svg" },
] as const;

/** VidMuse 复刻页脚：品牌、社交入口、三组导航与版权。 */
export function SiteFooter() {
  const t = useMessages(vidmuseMessages).footer;
  return (
    <footer className="vm-footer">
      <div className="vm-footer-inner">
        <div className="vm-footerGrid">
          <div className="vm-footerBrand">
            <Link aria-label={t.homeAria} href="#top">
              <BrandLogo className="vm-footerLogo" title={t.homeAria} />
            </Link>
            <p>{t.tagline}</p>
            <div className="vm-socials">
              {socials.map((social) => (
                <Link aria-label={t.socials[social.id]} href="#" key={social.id}>
                  <img alt="" src={social.icon} />
                </Link>
              ))}
            </div>
          </div>

          <nav aria-label={t.navAria} className="vm-footerNav">
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

        <div className="vm-footerBottom">
          <p>{t.copyright}</p>
        </div>
      </div>
    </footer>
  );
}

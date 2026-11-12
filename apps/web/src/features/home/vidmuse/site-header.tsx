import { Button, Link } from "@heroui/react";
import {
  IconChevronDown,
  IconDeviceTv,
  IconFolder,
  IconGift,
  IconMenu2,
  IconPlayerPlay,
  IconWorld,
  IconX,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useMessages } from "../../../i18n/messages";
import { BrandLogo } from "./brand-logo";
import { vidmuseMessages } from "./vidmuse-messages";

/** VidMuse 复刻页头：公告、吸顶导航与手机菜单；登录暂不接入功能。 */
export function SiteHeader() {
  const t = useMessages(vidmuseMessages).header;
  const [scrolled, setScrolled] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <AnimatePresence initial={false}>
        {bannerOpen && (
          <motion.div
            animate={{ height: 42, opacity: 1 }}
            className="vm-announcement"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 42, opacity: 1 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="vm-announcement-inner">
              <span>{t.announcement}</span>
              <Link className="vm-try-now" href="#formats">
                {t.tryNow}
                <svg aria-hidden="true" fill="none" viewBox="0 0 14 14">
                  <path
                    d="M3.5 10.5 10.5 3.5M5 3.5h5.5V9"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                  />
                </svg>
              </Link>
            </div>
            <Button
              isIconOnly
              aria-label={t.dismiss}
              className="vm-announcement-close"
              onPress={() => setBannerOpen(false)}
            >
              <IconX size={18} />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`vm-header-shell ${scrolled ? "is-scrolled" : ""}`} data-scrolled={scrolled}>
        <div aria-hidden="true" className="vm-header-blur" />
        <header className="vm-header">
          <div className="vm-header-inner">
            <div className="vm-header-left">
              <Link aria-label={t.homeAria} className="vm-logo" href="#top">
                <BrandLogo className="vm-logo-svg" title={t.homeAria} />
              </Link>

              <nav aria-label={t.navAria} className="vm-nav">
                {t.nav.map((item) => (
                  <Link
                    {...("active" in item && item.active
                      ? { "aria-current": "page" as const }
                      : {})}
                    className={`vm-nav-link ${"active" in item && item.active ? "is-active" : ""}`}
                    href={item.href}
                    key={item.label}
                  >
                    {item.label}
                    {"hasMenu" in item && item.hasMenu && (
                      <IconChevronDown aria-hidden="true" size={10} />
                    )}
                    {"badge" in item && item.badge && (
                      <span className="vm-nav-badge">{item.badge}</span>
                    )}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="vm-utilities">
              <Button isIconOnly aria-label={t.credits} className="vm-icon-btn vm-icon-btn--square">
                <IconGift size={17} />
              </Button>
              <Button isIconOnly aria-label={t.faq} className="vm-icon-btn">
                <IconDeviceTv size={17} />
              </Button>
              <Button aria-label={t.language} className="vm-lang-btn">
                <IconWorld size={16} />
                <span>{t.languageShort}</span>
                <IconChevronDown size={10} />
              </Button>
              <Button className="vm-pill-btn">
                <IconFolder size={15} />
                <span>{t.assets}</span>
              </Button>
              <Button className="vm-pill-btn">
                <IconPlayerPlay size={15} />
                <span>{t.projects}</span>
              </Button>
              <Button className="vm-login">{t.login}</Button>
              <Button
                isIconOnly
                aria-label={mobileOpen ? t.closeMenu : t.openMenu}
                className="vm-menu-btn"
                onPress={() => setMobileOpen((value) => !value)}
              >
                {mobileOpen ? <IconX size={20} /> : <IconMenu2 size={20} />}
              </Button>
            </div>
          </div>
        </header>

        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              animate={{ opacity: 1, y: 0 }}
              className="vm-mobile-nav"
              exit={{ opacity: 0, y: -10 }}
              initial={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22 }}
            >
              {t.nav.map((item) => (
                <Link
                  className={"active" in item && item.active ? "is-active" : ""}
                  href={item.href}
                  key={item.label}
                >
                  {item.label}
                </Link>
              ))}
              <div className="vm-mobile-actions">
                <Button className="vm-login">{t.login}</Button>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

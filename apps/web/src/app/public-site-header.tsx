import { Drawer } from "@heroui/react";
import { IconMenu2, IconX } from "@tabler/icons-react";
import { useCallback, useRef, useState } from "react";
import { RouteLink } from "../components/router-link";
import { UiIcon } from "../components/ui-icon";
import { AccountMenu } from "../features/account/menu/account-menu";
import type { useEnterpriseSession } from "../features/auth/auth-client";
import { scrollToLandingFaq } from "../features/home/landing/landing-faq-navigation";
import { scrollToLandingPricing } from "../features/home/landing/landing-pricing-navigation";
import { useMessages } from "../i18n/messages";
import { dashboardPath } from "../lib/dashboard-paths";
import { PublicSiteNavigation } from "./public-site-navigation";
import { shellMessages } from "./shell-messages";
import { SiteHeaderControls } from "./site-header-controls";
import { usePublicHeaderBrand } from "./use-public-header-brand";
import "./public-site-header.css";

/** 公共页面共用导航与账户入口，首页额外同步滚动品牌和区块焦点。 */
export function PublicSiteHeader({
  account,
  accountPending,
  isLanding,
  showStartCreating,
}: {
  account: ReturnType<typeof useEnterpriseSession>["data"];
  accountPending: boolean;
  isLanding: boolean;
  showStartCreating: boolean;
}) {
  const t = useMessages(shellMessages);
  const headerRef = useRef<HTMLElement>(null);
  const mobileSectionRequested = useRef<"faq" | "pricing" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { brandRef, canvasRef } = usePublicHeaderBrand(headerRef, isLanding);

  const closeMenu = () => setMenuOpen(false);
  const openFaq = isLanding ? () => scrollToLandingFaq(true) : undefined;
  const queueMobileFaq = () => {
    mobileSectionRequested.current = "faq";
  };
  const queueMobilePricing = () => {
    mobileSectionRequested.current = "pricing";
  };
  const mobileBackdropRef = useCallback((backdrop: HTMLDivElement | null) => {
    if (!backdrop) return;
    return () => {
      const section = mobileSectionRequested.current;
      if (!section) return;
      mobileSectionRequested.current = null;
      // 等菜单退出并解除焦点限制后，再将阅读焦点移到目标区块。
      window.requestAnimationFrame(() => {
        if (section === "pricing") scrollToLandingPricing();
        else scrollToLandingFaq(true);
      });
    };
  }, []);
  return (
    <header
      ref={headerRef}
      className="topbar public-site-header"
      data-landing-header={isLanding || undefined}
      data-signed-in={!!account || undefined}
    >
      <RouteLink
        to="/"
        className="public-site-brand"
        aria-label={t.home}
        onClick={() => {
          if (isLanding) {
            const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
          }
        }}
      >
        <span ref={brandRef} className="public-site-brand-art" aria-hidden="true">
          <img className="public-site-wordmark" src="/brand/lycobo-landing.svg" alt="" />
          {isLanding && (
            <>
              <img className="public-site-symbol" src="/brand/lycobo-landing.svg" alt="" />
              <canvas ref={canvasRef} />
            </>
          )}
        </span>
      </RouteLink>
      <Drawer isOpen={menuOpen} onOpenChange={setMenuOpen}>
        <Drawer.Trigger className="mobile-menu icon-button" aria-label={t.openNavigation}>
          <UiIcon icon={IconMenu2} size="navigation" />
        </Drawer.Trigger>
        <Drawer.Backdrop ref={mobileBackdropRef}>
          <Drawer.Content placement="left">
            <Drawer.Dialog className="mobile-nav">
              <Drawer.Header>
                <Drawer.Heading>
                  <img
                    className="lycobo-logo"
                    alt="Lycobo"
                    src="/brand/lycobo-landing.svg"
                    width={120}
                    height={35}
                  />
                </Drawer.Heading>
                <Drawer.CloseTrigger aria-label={t.closeNavigation}>
                  <UiIcon icon={IconX} size="action" />
                </Drawer.CloseTrigger>
              </Drawer.Header>
              <Drawer.Body>
                <PublicSiteNavigation
                  onNavigate={closeMenu}
                  onFaq={isLanding ? queueMobileFaq : undefined}
                  onPricing={isLanding ? queueMobilePricing : undefined}
                />
              </Drawer.Body>
              {account && (
                <Drawer.Footer className="mobile-nav-account">
                  <AccountMenu onNavigate={closeMenu} />
                </Drawer.Footer>
              )}
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
      <PublicSiteNavigation
        onFaq={openFaq}
        onPricing={isLanding ? scrollToLandingPricing : undefined}
      />
      <div className="public-site-actions">
        <SiteHeaderControls account={account} accountPending={accountPending} publicMenus />
        {showStartCreating && (
          <RouteLink to={dashboardPath} className="public-site-start">
            {t.startCreating}
          </RouteLink>
        )}
      </div>
    </header>
  );
}

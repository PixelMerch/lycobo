import { Drawer } from "@heroui/react";
import { IconMenu2, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { RouteLink } from "../components/router-link";
import { UiIcon } from "../components/ui-icon";
import { AccountMenu } from "../features/account/menu/account-menu";
import type { useEnterpriseSession } from "../features/auth/auth-client";
import {
  type LandingFrame,
  readLandingScroll,
  scrollLandingFrame,
} from "../features/home/landing/landing-frame";
import { navigationMessages } from "../features/home/landing/navigation-messages";
import { useMessages } from "../i18n/messages";
import { dashboardPath } from "../lib/dashboard-paths";
import { PublicSiteNavigation } from "./public-site-navigation";
import { shellMessages } from "./shell-messages";
import { SiteHeaderControls } from "./site-header-controls";
import { usePublicHeaderBrand } from "./use-public-header-brand";
import "./public-site-header.css";

/** 首页与灵感库共用导航、品牌动效、移动菜单和账户入口。 */
export function PublicSiteHeader({
  account,
  landingFrame,
  showStartCreating,
}: {
  account: ReturnType<typeof useEnterpriseSession>["data"];
  landingFrame: LandingFrame | undefined;
  showStartCreating: boolean;
}) {
  const t = useMessages(shellMessages);
  const navigation = useMessages(navigationMessages);
  const headerRef = useRef<HTMLElement>(null);
  const scroll = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dismissVersion, setDismissVersion] = useState(0);
  const { brandRef, canvasRef, scheduleDraw } = usePublicHeaderBrand(headerRef, scroll);
  const frameRef = landingFrame?.frameRef;

  useEffect(() => {
    function update(scrollY: number) {
      scroll.current = scrollY;
      scheduleDraw();
    }

    if (!frameRef) {
      const read = () => update(window.scrollY);
      read();
      window.addEventListener("scroll", read, { passive: true });
      return () => window.removeEventListener("scroll", read);
    }

    function receive(event: MessageEvent<unknown>) {
      if (event.source !== frameRef?.current?.contentWindow) return;
      if (event.data === "lycobo:landing-pointerdown") setDismissVersion((version) => version + 1);
      const position = readLandingScroll(event.data);
      if (position !== null) update(position);
    }

    update(0);
    window.addEventListener("message", receive);
    frameRef.current?.contentWindow?.postMessage("lycobo:landing-scroll-request", "*");
    return () => window.removeEventListener("message", receive);
  }, [frameRef, scheduleDraw]);

  const closeMenu = () => setMenuOpen(false);
  return (
    <header
      ref={headerRef}
      className="topbar public-site-header"
      data-landing-frame={!!landingFrame || undefined}
      data-signed-in={!!account || undefined}
    >
      <Drawer isOpen={menuOpen} onOpenChange={setMenuOpen}>
        <Drawer.Trigger className="mobile-menu icon-button" aria-label={t.openNavigation}>
          <UiIcon icon={IconMenu2} size="navigation" />
        </Drawer.Trigger>
        <Drawer.Backdrop>
          <Drawer.Content placement="left">
            <Drawer.Dialog className="mobile-nav">
              <Drawer.Header>
                <Drawer.Heading>
                  <img
                    className="lycobo-logo"
                    alt="Lycobo"
                    src="/brand/lycobo-reveal.svg"
                    width={120}
                    height={32}
                  />
                </Drawer.Heading>
                <Drawer.CloseTrigger aria-label={t.closeNavigation}>
                  <UiIcon icon={IconX} size="action" />
                </Drawer.CloseTrigger>
              </Drawer.Header>
              <Drawer.Body>
                <PublicSiteNavigation onNavigate={closeMenu} />
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
      <RouteLink
        to="/"
        className="public-site-brand"
        aria-label={t.home}
        onClick={() => {
          if (frameRef) scrollLandingFrame(frameRef, 0);
        }}
      >
        <span ref={brandRef} className="public-site-brand-art" aria-hidden="true">
          <img className="public-site-wordmark" src="/brand/lycobo-landing.svg" alt="" />
          <img className="public-site-symbol" src="/brand/lycobo-landing.svg" alt="" />
          <canvas ref={canvasRef} />
        </span>
      </RouteLink>
      <PublicSiteNavigation dismissVersion={dismissVersion} />
      <div className="public-site-actions">
        <SiteHeaderControls
          account={account}
          dismissVersion={dismissVersion}
          onLanguageChange={() => {
            if (landingFrame) landingFrame.pendingScroll.current = scroll.current;
          }}
        />
        {showStartCreating && (
          <RouteLink to={dashboardPath} className="public-site-start">
            {navigation.copy009}
          </RouteLink>
        )}
      </div>
    </header>
  );
}

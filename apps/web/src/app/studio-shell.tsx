import { Button, Drawer, Tooltip } from "@heroui/react";
import {
  IconFolderSparkle,
  IconLayoutSidebar,
  IconLayoutSidebarRight,
  IconMenu2,
  IconShoppingBagSearch,
  IconSmartHome,
  IconX,
} from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { RouteLink } from "../components/router-link";
import { UiIcon } from "../components/ui-icon";
import { AccountMenu, HeaderLogin } from "../features/account/account-menu";
import { AccountOverlayHost } from "../features/account/account-overlays";
import { HeaderBenefits } from "../features/account/header-benefits";
import { useEnterpriseSession } from "../features/auth/auth-client";
import { useImageEvents } from "../features/generation/use-image-events";
import "../styles/brand.css";

export interface StudioShellContext {
  setHomeHeaderOpaque: Dispatch<SetStateAction<boolean>>;
}

export function StudioShell() {
  useImageEvents();
  const { pathname } = useLocation();
  const inWorkspace =
    pathname.startsWith("/create") || pathname.startsWith("/commerce") || pathname === "/workspace";
  const signedIn = !!useEnterpriseSession().data;
  const [homeHeaderOpaque, setHomeHeaderOpaque] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const expandedSidebarWidth = viewportWidth >= 2560 ? 320 : viewportWidth >= 1800 ? 288 : 274;
  const sidebarWidth =
    viewportWidth < 768 ? "0px" : sidebarCollapsed ? "64px" : `${expandedSidebarWidth}px`;
  const nav = (
    <>
      <Tooltip delay={300} isDisabled={!sidebarCollapsed}>
        <RouteLink
          nav
          to="/"
          end
          aria-label="首页"
          className="nav-row"
          onClick={() => setMenuOpen(false)}
        >
          <UiIcon icon={IconSmartHome} size="default" />
          <span className="nav-label">首页</span>
        </RouteLink>
        <Tooltip.Content placement="right">首页</Tooltip.Content>
      </Tooltip>
      <Tooltip delay={300} isDisabled={!sidebarCollapsed}>
        <RouteLink
          to="/workspace"
          aria-label="工作区"
          className={`nav-row${inWorkspace ? " active" : ""}`}
          onClick={() => setMenuOpen(false)}
        >
          <UiIcon icon={IconShoppingBagSearch} size="default" />
          <span className="nav-label">工作区</span>
        </RouteLink>
        <Tooltip.Content placement="right">工作区</Tooltip.Content>
      </Tooltip>
      <Tooltip delay={300} isDisabled={!sidebarCollapsed}>
        <RouteLink
          nav
          to="/assets"
          aria-label="素材库"
          className="nav-row"
          onClick={() => setMenuOpen(false)}
        >
          <UiIcon icon={IconFolderSparkle} size="default" />
          <span className="nav-label">素材库</span>
        </RouteLink>
        <Tooltip.Content placement="right">素材库</Tooltip.Content>
      </Tooltip>
    </>
  );
  return (
    <motion.div
      className="studio-app"
      data-sidebar-collapsed={sidebarCollapsed}
      data-home-header-opaque={pathname === "/" && homeHeaderOpaque}
      animate={{ "--sidebar-width": sidebarWidth }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <aside className="sidebar" aria-label="主导航">
        <div className="sidebar-header">
          <RouteLink to="/" className="brand">
            <img
              className="lycobo-logo"
              src="/brand/lycobo-product-pilot.svg"
              alt="Lycobo"
              width="120"
              height="24"
            />
          </RouteLink>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            className="sidebar-toggle"
            aria-label={sidebarCollapsed ? "展开导航栏" : "收起导航栏"}
            aria-expanded={!sidebarCollapsed}
            aria-controls="studio-sidebar-navigation"
            onPress={() => setSidebarCollapsed((collapsed) => !collapsed)}
          >
            <img
              className="sidebar-compact-mark"
              src="/brand/lycobo-product-pilot-mark.svg"
              alt=""
              width="24"
              height="24"
            />
            <UiIcon
              icon={sidebarCollapsed ? IconLayoutSidebarRight : IconLayoutSidebar}
              size="default"
            />
          </Button>
        </div>
        <nav id="studio-sidebar-navigation">{nav}</nav>
        <div className="sidebar-bottom">{signedIn && <AccountMenu />}</div>
      </aside>
      <header className="topbar">
        <Drawer isOpen={menuOpen} onOpenChange={setMenuOpen}>
          <Drawer.Trigger className="mobile-menu icon-button" aria-label="打开导航">
            <UiIcon icon={IconMenu2} size="navigation" />
          </Drawer.Trigger>
          <Drawer.Backdrop>
            <Drawer.Content placement="left">
              <Drawer.Dialog className="mobile-nav">
                <Drawer.Header>
                  <Drawer.Heading>
                    <img
                      className="lycobo-logo"
                      src="/brand/lycobo-product-pilot.svg"
                      alt="Lycobo"
                      width="120"
                      height="24"
                    />
                  </Drawer.Heading>
                  <Drawer.CloseTrigger aria-label="关闭导航">
                    <UiIcon icon={IconX} size="action" />
                  </Drawer.CloseTrigger>
                </Drawer.Header>
                <Drawer.Body>
                  <nav>{nav}</nav>
                </Drawer.Body>
                {signedIn && (
                  <Drawer.Footer className="mobile-nav-account">
                    <AccountMenu onNavigate={() => setMenuOpen(false)} />
                  </Drawer.Footer>
                )}
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer>
        <div className="header-actions">{signedIn ? <HeaderBenefits /> : <HeaderLogin />}</div>
      </header>
      <main className="main-content">
        <Outlet context={{ setHomeHeaderOpaque } satisfies StudioShellContext} />
      </main>
      {signedIn && <AccountOverlayHost onNavigate={() => setMenuOpen(false)} />}
    </motion.div>
  );
}

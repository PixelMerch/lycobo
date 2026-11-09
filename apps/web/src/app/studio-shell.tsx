import { Drawer } from "@heroui/react";
import { IconFolderSparkle, IconMenu2, IconSmartHome, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { RouteLink } from "../components/router-link";
import { UiIcon } from "../components/ui-icon";
import { AccountOverlayHost } from "../features/account/account-overlays";
import { AccountMenu, HeaderLogin } from "../features/account/menu/account-menu";
import { HeaderBenefits } from "../features/account/menu/header-benefits";
import { AccountUpdates } from "../features/account/notifications/account-updates";
import { useEnterpriseSession } from "../features/auth/auth-client";
import { loginHref } from "../features/auth/login-navigation";
import { useImageEvents } from "../features/generation/use-image-events";
import { shareProductReference, workspaceTools } from "../features/workspace/workspace-state";
import { toolIcons } from "../features/workspace/workspace-tool-symbol";
import { CommerceNavMenu } from "./commerce-nav-menu";
import { PageLoading } from "./page-loading";
import { useWindowScrolled } from "./use-window-scrolled";
import "../styles/brand.css";

/** 组合应用导航和业务区域，未登录时转往独立登录页面。 */
export function StudioShell() {
  const location = useLocation();
  const { pathname } = location;
  const inWorkspace = isWorkspacePath(pathname);
  const session = useEnterpriseSession();
  const signedIn = !!session.data;
  const protectedRoute = pathname !== "/";
  const routeNeedsLogin = protectedRoute && !signedIn;
  const scrolled = useWindowScrolled();
  const [menuOpen, setMenuOpen] = useState(false);
  if (routeNeedsLogin && !session.isPending)
    return <Navigate to={loginHref(`${pathname}${location.search}${location.hash}`)} replace />;
  return (
    <div className="studio-app">
      <header className="topbar" data-scrolled={scrolled || undefined}>
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
                  <DrawerNavigation pathname={pathname} onNavigate={() => setMenuOpen(false)} />
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
        <RouteLink to="/" className="brand">
          <img
            className="lycobo-logo"
            src="/brand/lycobo-product-pilot.svg"
            alt="Lycobo"
            width="120"
            height="24"
          />
        </RouteLink>
        <nav className="topbar-nav" aria-label="主导航">
          <RouteLink nav to="/" end className="nav-row">
            首页
          </RouteLink>
          <CommerceNavMenu active={inWorkspace} />
          <RouteLink nav to="/assets" className="nav-row">
            素材库
          </RouteLink>
        </nav>
        <div className="header-actions">
          {signedIn ? (
            <>
              <div className="header-news">
                <AccountUpdates kind="updates" />
                <AccountUpdates kind="messages" />
              </div>
              <HeaderBenefits />
              <AccountMenu variant="header" />
            </>
          ) : (
            <HeaderLogin />
          )}
        </div>
      </header>
      <main className="main-content">
        {routeNeedsLogin && session.isPending && <PageLoading />}
        {!routeNeedsLogin && <Outlet />}
      </main>
      <RealtimeEvents />
      {signedIn && <AccountOverlayHost />}
    </div>
  );
}

function RealtimeEvents() {
  useImageEvents();
  return null;
}

/** 手机导航抽屉：首页、电商四个工具与素材库；切换工具时与工具坞一样只向空图片槽带图。 */
function DrawerNavigation({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  return (
    <nav aria-label="主导航">
      <RouteLink nav to="/" end className="nav-row" onClick={onNavigate}>
        <UiIcon icon={IconSmartHome} size="default" />
        <span className="nav-label">首页</span>
      </RouteLink>
      <p className="nav-group-label">电商</p>
      {workspaceTools.map((tool) => (
        <RouteLink
          key={tool.id}
          nav
          to={tool.path}
          className="nav-row"
          onClick={() => {
            shareProductReference(pathname, tool.path);
            onNavigate();
          }}
        >
          <UiIcon icon={toolIcons[tool.id]} size="default" />
          <span className="nav-label">{tool.name}</span>
        </RouteLink>
      ))}
      <RouteLink nav to="/assets" className="nav-row" onClick={onNavigate}>
        <UiIcon icon={IconFolderSparkle} size="default" />
        <span className="nav-label">素材库</span>
      </RouteLink>
    </nav>
  );
}

function isWorkspacePath(pathname: string) {
  return pathname.startsWith("/commerce") || pathname === "/workspace" || pathname === "/video";
}

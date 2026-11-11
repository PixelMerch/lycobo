import { Button, Drawer } from "@heroui/react";
import { IconBulb, IconFolderSparkle, IconMenu2, IconSmartHome, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { Navigate, Outlet } from "react-router";
import { RouteLink } from "../components/router-link";
import { UiIcon } from "../components/ui-icon";
import { AccountOverlayHost } from "../features/account/account-overlays";
import { AccountMenu, HeaderLogin } from "../features/account/menu/account-menu";
import { HeaderBenefits } from "../features/account/menu/header-benefits";
import { AccountMessages } from "../features/account/notifications/account-messages";
import { AssetLibraryHost } from "../features/assets/asset-library-host";
import { useOpenAssetLibrary } from "../features/assets/asset-library-store";
import { useEnterpriseSession } from "../features/auth/auth-client";
import { loginHref } from "../features/auth/login-navigation";
import { useImageEvents } from "../features/generation/use-image-events";
import { inspirationLibraryPath } from "../features/home/inspiration-path";
import { legalPaths } from "../features/legal/legal-document";
import {
  shareProductReference,
  visibleWorkspaceTools,
} from "../features/workspace/workspace-state";
import { workspaceToolMessages } from "../features/workspace/workspace-tool-messages";
import { toolIcons } from "../features/workspace/workspace-tool-symbol";
import { useMessages } from "../i18n/messages";
import { useAppLocation } from "../i18n/use-localized-navigation";
import { CommerceNavMenu } from "./commerce-nav-menu";
import { LanguageMenu } from "./language-menu";
import { PageLoading } from "./page-loading";
import { shellMessages } from "./shell-messages";
import { useWindowScrolled } from "./use-window-scrolled";
import "../styles/brand.css";

// 首页与用户协议、隐私政策不需要登录，其他页面未登录时先去登录。
const publicPaths = new Set<string>([
  "/",
  inspirationLibraryPath,
  legalPaths.terms,
  legalPaths.privacy,
]);

/** 组合应用导航和业务区域，未登录时转往独立登录页面。 */
export function StudioShell() {
  const location = useAppLocation();
  const { pathname } = location;
  const inWorkspace = isWorkspacePath(pathname);
  const session = useEnterpriseSession();
  const signedIn = !!session.data;
  const protectedRoute = !publicPaths.has(pathname);
  const routeNeedsLogin = protectedRoute && !signedIn;
  const scrolled = useWindowScrolled();
  const [menuOpen, setMenuOpen] = useState(false);
  const t = useMessages(shellMessages);
  if (routeNeedsLogin && !session.isPending)
    return (
      <Navigate
        to={loginHref(`${location.pathnameWithLocale}${location.search}${location.hash}`)}
        replace
      />
    );
  return (
    <div className="studio-app">
      {/* 工作区里顶部栏固定为实色、滚动时不收窄；其他页面在顶部透明、滚动后变磨砂。 */}
      <header
        className="topbar"
        data-scrolled={(scrolled && !inWorkspace) || undefined}
        data-solid={inWorkspace || undefined}
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
                      src="/brand/lycobo-reveal.svg"
                      alt="Lycobo"
                      width="120"
                      height="32"
                    />
                  </Drawer.Heading>
                  <Drawer.CloseTrigger aria-label={t.closeNavigation}>
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
            src="/brand/lycobo-reveal.svg"
            alt="Lycobo"
            width="120"
            height="32"
          />
        </RouteLink>
        {/* 素材库不在顶部导航（用户 2026-11-10 要求）：从首页快捷入口、账户菜单等处直接打开弹窗。
            “灵感”进入灵感库页面（用户 2026-11-11 要求）。 */}
        <nav className="topbar-nav" aria-label={t.mainNavigation}>
          <RouteLink nav to="/" end className="nav-row">
            {t.home}
          </RouteLink>
          <CommerceNavMenu active={inWorkspace} />
          <RouteLink nav to={inspirationLibraryPath} end className="nav-row">
            {t.inspiration}
          </RouteLink>
        </nav>
        <div className="header-actions">
          {signedIn ? (
            <>
              <div className="header-news">
                <AccountMessages />
              </div>
              <LanguageMenu />
              <HeaderBenefits />
              <AccountMenu variant="header" />
            </>
          ) : (
            <>
              <LanguageMenu />
              <HeaderLogin />
            </>
          )}
        </div>
      </header>
      <main className="main-content">
        {routeNeedsLogin && session.isPending && <PageLoading />}
        {!routeNeedsLogin && <Outlet />}
      </main>
      <RealtimeEvents />
      {signedIn && <AccountOverlayHost />}
      {signedIn && <AssetLibraryHost />}
    </div>
  );
}

function RealtimeEvents() {
  useImageEvents();
  return null;
}

/**
 * 手机导航抽屉：首页、电商四个工具、灵感与素材库；切换工具时与工具坞一样只向空图片槽带图。
 * 素材库是弹窗，点它先收起抽屉再打开，不跳转页面。
 */
function DrawerNavigation({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const t = useMessages(shellMessages);
  const toolText = useMessages(workspaceToolMessages);
  const openLibrary = useOpenAssetLibrary();
  return (
    <nav aria-label={t.mainNavigation}>
      <RouteLink nav to="/" end className="nav-row" onClick={onNavigate}>
        <UiIcon icon={IconSmartHome} size="default" />
        <span className="nav-label">{t.home}</span>
      </RouteLink>
      <p className="nav-group-label">{t.commerce}</p>
      {visibleWorkspaceTools.map((tool) => (
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
          <span className="nav-label">{toolText.tools[tool.id].name}</span>
        </RouteLink>
      ))}
      <RouteLink nav to={inspirationLibraryPath} end className="nav-row" onClick={onNavigate}>
        <UiIcon icon={IconBulb} size="default" />
        <span className="nav-label">{t.inspiration}</span>
      </RouteLink>
      <Button
        variant="ghost"
        className="nav-row"
        onPress={() => {
          onNavigate();
          openLibrary();
        }}
      >
        <UiIcon icon={IconFolderSparkle} size="default" />
        <span className="nav-label">{t.assets}</span>
      </Button>
    </nav>
  );
}

function isWorkspacePath(pathname: string) {
  return pathname.startsWith("/commerce") || pathname === "/workspace" || pathname === "/video";
}

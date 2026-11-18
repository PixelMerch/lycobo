import { Button, Drawer, Tooltip } from "@heroui/react";
import {
  IconBrush,
  IconFolderSparkle,
  IconMenu2,
  IconSmartHome,
  IconSpaces,
  IconX,
} from "@tabler/icons-react";
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
import { commercePath, commerceToolHref, commerceTools } from "../features/commerce/commerce-tools";
import { freeCanvasPath } from "../features/free-canvas/free-canvas-path";
import { useImageEvents } from "../features/generation/use-image-events";
import { inspirationLibraryPath } from "../features/inspiration/inspiration-path";
import { legalPaths } from "../features/legal/legal-document";
import { workspaceToolMessages } from "../features/workspace/workspace-tool-messages";
import { toolIcons } from "../features/workspace/workspace-tool-symbol";
import { useMessages } from "../i18n/messages";
import { useAppLocation, useAppNavigate } from "../i18n/use-localized-navigation";
import { CommerceNavMenu } from "./commerce-nav-menu";
import { LanguageMenu } from "./language-menu";
import { PageLoading } from "./page-loading";
import { shellMessages } from "./shell-messages";
import { SiteHeaderControls } from "./site-header-controls";
import { useWindowScrolled } from "./use-window-scrolled";
import "../styles/brand.css";

// 首页与用户协议、隐私政策不需要登录，其他页面未登录时先去登录。
const publicPaths = new Set<string>([
  commercePath,
  inspirationLibraryPath,
  legalPaths.terms,
  legalPaths.privacy,
]);

const studioLogo = { src: "/brand/lycobo-reveal.svg", width: 120, height: 32 };

/** 组合应用导航和业务区域，未登录时转往独立登录页面。 */
export function StudioShell() {
  const location = useAppLocation();
  const { pathname } = location;
  const t = useMessages(shellMessages);
  const landing = pathname === commercePath;
  const workspace = isWorkspacePath(pathname);
  const session = useEnterpriseSession();
  const signedIn = !!session.data;
  const protectedRoute = !publicPaths.has(pathname);
  const routeNeedsLogin = protectedRoute && !signedIn;
  if (routeNeedsLogin && !session.isPending)
    return (
      <Navigate
        to={loginHref(`${location.pathnameWithLocale}${location.search}${location.hash}`)}
        replace
      />
    );
  return (
    <div className="studio-app" data-workspace-site-header={workspace || undefined}>
      {workspace && session.data && (
        <header className="workspace-site-header">
          <RouteLink to="/" className="workspace-site-brand" aria-label={t.home}>
            <img src="/brand/lycobo-landing.svg" width={155} height={46} alt="Lycobo" />
          </RouteLink>
          <SiteHeaderControls account={session.data} />
        </header>
      )}
      {!landing && !workspace && <StudioHeader account={session.data} />}
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

/** 其余页面保留原工作区和账户导航。 */
function StudioHeader({ account }: { account: ReturnType<typeof useEnterpriseSession>["data"] }) {
  const scrolled = useWindowScrolled();
  const [menuOpen, setMenuOpen] = useState(false);
  const t = useMessages(shellMessages);
  return (
    <header className="topbar" data-scrolled={scrolled || undefined}>
      <Drawer isOpen={menuOpen} onOpenChange={setMenuOpen}>
        <Drawer.Trigger className="mobile-menu icon-button" aria-label={t.openNavigation}>
          <UiIcon icon={IconMenu2} size="navigation" />
        </Drawer.Trigger>
        <Drawer.Backdrop>
          <Drawer.Content placement="left">
            <Drawer.Dialog className="mobile-nav">
              <Drawer.Header>
                <Drawer.Heading>
                  <img className="lycobo-logo" alt="Lycobo" {...studioLogo} />
                </Drawer.Heading>
                <Drawer.CloseTrigger aria-label={t.closeNavigation}>
                  <UiIcon icon={IconX} size="action" />
                </Drawer.CloseTrigger>
              </Drawer.Header>
              <Drawer.Body>
                <DrawerNavigation onNavigate={() => setMenuOpen(false)} />
              </Drawer.Body>
              {account && (
                <Drawer.Footer className="mobile-nav-account">
                  <AccountMenu onNavigate={() => setMenuOpen(false)} />
                </Drawer.Footer>
              )}
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>
      <RouteLink to="/" className="brand">
        <img className="lycobo-logo" alt="Lycobo" {...studioLogo} />
      </RouteLink>
      <HeaderNavigation />
      <HeaderActions account={account} />
    </header>
  );
}

/** 站内常规页面的主导航。 */
function HeaderNavigation() {
  const t = useMessages(shellMessages);
  return (
    <nav className="topbar-nav" aria-label={t.mainNavigation}>
      <RouteLink nav to="/" end className="nav-row">
        {t.home}
      </RouteLink>
      <CommerceNavMenu homeGlass={false} />
      <RouteLink nav to={freeCanvasPath} className="nav-row">
        {t.freeCanvas}
      </RouteLink>
    </nav>
  );
}

/** 常规页面的工作区、语言和账户入口。 */
function HeaderActions({ account }: { account: ReturnType<typeof useEnterpriseSession>["data"] }) {
  const navigate = useAppNavigate();
  const t = useMessages(shellMessages);
  return (
    <div className="header-actions">
      <div className="header-news" data-signed-in={!!account}>
        <AccountMessages signedIn={!!account} showTrigger={!!account} />
      </div>
      <Tooltip delay={200}>
        <Button
          isIconOnly
          size="sm"
          variant="tertiary"
          aria-label={t.workspace}
          className="header-workspace"
          onPress={() => void navigate("/workspace")}
        >
          <UiIcon icon={IconSpaces} size="navigation" />
        </Button>
        <Tooltip.Content placement="bottom">{t.workspace}</Tooltip.Content>
      </Tooltip>
      <LanguageMenu account={account} />
      {account ? (
        <>
          <HeaderBenefits />
          <AccountMenu variant="header" />
        </>
      ) : (
        <HeaderLogin />
      )}
    </div>
  );
}

function RealtimeEvents() {
  useImageEvents();
  return null;
}

/** 常规页面的手机导航抽屉。 */
function DrawerNavigation({ onNavigate }: { onNavigate: () => void }) {
  const t = useMessages(shellMessages);
  const toolText = useMessages(workspaceToolMessages);
  const openLibrary = useOpenAssetLibrary();
  return (
    <nav aria-label={t.mainNavigation}>
      <RouteLink nav to="/" end className="nav-row" onClick={onNavigate}>
        <UiIcon icon={IconSmartHome} size="default" />
        <span className="nav-label">{t.home}</span>
      </RouteLink>
      <RouteLink to="/workspace" className="nav-row" onClick={onNavigate}>
        <UiIcon icon={IconSpaces} size="default" />
        <span className="nav-label">{t.workspace}</span>
      </RouteLink>
      <p className="nav-group-label">{t.commerce}</p>
      {commerceTools.map((tool) => (
        <RouteLink
          key={tool.id}
          to={commerceToolHref(tool.id)}
          className="nav-row"
          onClick={onNavigate}
        >
          <UiIcon icon={toolIcons[tool.id]} size="default" />
          <span className="nav-label">
            {tool.id === "replica" ? t.replica : toolText.tools[tool.id].name}
          </span>
        </RouteLink>
      ))}
      <RouteLink to={freeCanvasPath} className="nav-row" onClick={onNavigate}>
        <UiIcon icon={IconBrush} size="default" />
        <span className="nav-label">{t.freeCanvas}</span>
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
  return (
    commerceTools.some((tool) => pathname === tool.href || pathname.startsWith(`${tool.href}/`)) ||
    pathname === "/workspace" ||
    pathname === "/video" ||
    pathname === freeCanvasPath
  );
}

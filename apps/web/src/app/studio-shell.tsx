import { Button, Drawer, Tooltip } from "@heroui/react";
import {
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
import { useImageEvents } from "../features/generation/use-image-events";
import { inspirationLibraryPath } from "../features/home/inspiration-path";
import { legalPaths } from "../features/legal/legal-document";
import { workspaceToolMessages } from "../features/workspace/workspace-tool-messages";
import { toolIcons } from "../features/workspace/workspace-tool-symbol";
import { useMessages } from "../i18n/messages";
import { useAppLocation, useAppNavigate } from "../i18n/use-localized-navigation";
import { CommerceNavMenu } from "./commerce-nav-menu";
import { HomeHeaderUtilities } from "./home-header-utilities";
import { LanguageMenu } from "./language-menu";
import { PageLoading } from "./page-loading";
import { shellMessages } from "./shell-messages";
import { useWindowScrolled } from "./use-window-scrolled";
import "../styles/brand.css";

// 首页与用户协议、隐私政策不需要登录，其他页面未登录时先去登录。
const publicPaths = new Set<string>([
  "/",
  commercePath,
  inspirationLibraryPath,
  legalPaths.terms,
  legalPaths.privacy,
]);

const headerLogos = {
  home: { src: "/brand/lycobo-landing.svg", width: 90, height: 28 },
  studio: { src: "/brand/lycobo-reveal.svg", width: 120, height: 32 },
};
const landingPaths = new Set<string>(["/", commercePath]);

/** 组合应用导航和业务区域，未登录时转往独立登录页面。 */
export function StudioShell() {
  const location = useAppLocation();
  const { pathname } = location;
  const landing = landingPaths.has(pathname);
  const inWorkspace = isWorkspacePath(pathname);
  const commerceHeader = landing || inWorkspace;
  const logo = headerLogos[commerceHeader ? "home" : "studio"];
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
        data-commerce-header={commerceHeader || undefined}
        data-landing={landing || undefined}
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
                    <img className="lycobo-logo" alt="Lycobo" {...logo} />
                  </Drawer.Heading>
                  <Drawer.CloseTrigger aria-label={t.closeNavigation}>
                    <UiIcon icon={IconX} size="action" />
                  </Drawer.CloseTrigger>
                </Drawer.Header>
                <Drawer.Body>
                  <DrawerNavigation
                    inWorkspace={inWorkspace}
                    commerceHeader={commerceHeader}
                    onNavigate={() => setMenuOpen(false)}
                  />
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
          <img className="lycobo-logo" alt="Lycobo" {...logo} />
        </RouteLink>
        <HeaderNavigation commerceHeader={commerceHeader} />
        <HeaderActions
          commerceHeader={commerceHeader}
          inWorkspace={inWorkspace}
          account={session.data}
        />
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

function HeaderNavigation({ commerceHeader }: { commerceHeader: boolean }) {
  const t = useMessages(shellMessages);
  return (
    <nav className="topbar-nav" aria-label={t.mainNavigation}>
      <RouteLink nav to="/" end className="nav-row">
        {t.home}
      </RouteLink>
      <CommerceNavMenu homeGlass={commerceHeader} />
    </nav>
  );
}

function HeaderActions({
  commerceHeader,
  inWorkspace,
  account,
}: {
  commerceHeader: boolean;
  inWorkspace: boolean;
  account: ReturnType<typeof useEnterpriseSession>["data"];
}) {
  const { pathname, search, hash } = useAppLocation();
  const navigate = useAppNavigate();
  const t = useMessages(shellMessages);
  const controls = (
    <>
      <Tooltip delay={200}>
        <Button
          isIconOnly
          size="sm"
          variant="tertiary"
          aria-label={t.workspace}
          className="header-workspace"
          aria-current={inWorkspace ? "page" : false}
          onPress={() => void navigate(inWorkspace ? `${pathname}${search}${hash}` : "/workspace")}
        >
          <UiIcon icon={IconSpaces} size="navigation" />
        </Button>
        <Tooltip.Content placement="bottom">{t.workspace}</Tooltip.Content>
      </Tooltip>
      <LanguageMenu account={account} homeGlass={commerceHeader} />
    </>
  );
  const messages = (
    <div className="header-news" data-signed-in={!!account}>
      <AccountMessages signedIn={!!account} showTrigger={commerceHeader || !!account} />
    </div>
  );
  return (
    <div className="header-actions">
      {commerceHeader ? (
        <HomeHeaderUtilities messages={messages}>{controls}</HomeHeaderUtilities>
      ) : (
        <>
          {messages}
          {controls}
        </>
      )}
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

/** 手机抽屉提供与桌面同样的工作区和专区工具入口。 */
function DrawerNavigation({
  inWorkspace,
  onNavigate,
  commerceHeader,
}: {
  inWorkspace: boolean;
  onNavigate: () => void;
  commerceHeader: boolean;
}) {
  const { pathname, search, hash } = useAppLocation();
  const t = useMessages(shellMessages);
  const toolText = useMessages(workspaceToolMessages);
  const openLibrary = useOpenAssetLibrary();
  return (
    <nav aria-label={t.mainNavigation}>
      <RouteLink nav to="/" end className="nav-row" onClick={onNavigate}>
        <UiIcon icon={IconSmartHome} size="default" />
        <span className="nav-label">{t.home}</span>
      </RouteLink>
      <RouteLink
        nav
        end
        to={inWorkspace ? `${pathname}${search}${hash}` : "/workspace"}
        className="nav-row"
        onClick={onNavigate}
      >
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
      {commerceHeader ? (
        <HomeHeaderUtilities onNavigate={onNavigate} />
      ) : (
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
      )}
    </nav>
  );
}

function isWorkspacePath(pathname: string) {
  return (
    pathname.startsWith(`${commercePath}/`) || pathname === "/workspace" || pathname === "/video"
  );
}

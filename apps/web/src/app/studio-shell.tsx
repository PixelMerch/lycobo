import { Button, Drawer, Modal, Tooltip } from "@heroui/react";
import {
  IconFolderSparkle,
  IconHelpCircle,
  IconLayoutSidebar,
  IconLayoutSidebarRight,
  IconMenu2,
  IconSettings,
  IconShoppingBagSearch,
  IconSmartHome,
  IconX,
} from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { RouteLink } from "../components/router-link";
import { UiIcon } from "../components/ui-icon";
import { AccountMenu, HeaderLogin } from "../features/account/account-menu";
import { useEnterpriseSession } from "../features/auth/auth-client";
import { useImageEvents } from "../features/generation/use-image-events";
import "../styles/brand.css";

export function StudioShell() {
  useImageEvents();
  const { pathname } = useLocation();
  const inWorkspace =
    pathname.startsWith("/create") || pathname.startsWith("/commerce") || pathname === "/workspace";
  const signedIn = !!useEnterpriseSession().data;
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
  const [info, setInfo] = useState<string | null>(null);
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
        <div className="sidebar-bottom">
          <Tooltip delay={300} isDisabled={!sidebarCollapsed}>
            <Button
              variant="tertiary"
              className="nav-row"
              aria-label="帮助中心"
              onPress={() => setInfo("帮助中心")}
            >
              <UiIcon icon={IconHelpCircle} size="default" />
              <span className="nav-label">帮助中心</span>
            </Button>
            <Tooltip.Content placement="right">帮助中心</Tooltip.Content>
          </Tooltip>
          {signedIn ? (
            <AccountMenu />
          ) : (
            <Tooltip delay={300} isDisabled={!sidebarCollapsed}>
              <Button
                variant="tertiary"
                className="nav-row"
                aria-label="账户设置"
                onPress={() => setInfo("账户设置")}
              >
                <UiIcon icon={IconSettings} size="default" />
                <span className="nav-label">账户设置</span>
              </Button>
              <Tooltip.Content placement="right">账户设置</Tooltip.Content>
            </Tooltip>
          )}
        </div>
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
                  <Drawer.CloseTrigger aria-label="关闭导航" />
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
        <div className="header-actions">
          <HeaderLogin />
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
      <Modal
        isOpen={info !== null}
        onOpenChange={(open) => {
          if (!open) setInfo(null);
        }}
      >
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog className="info-dialog">
              <Modal.Header>
                <Modal.Heading>{info}</Modal.Heading>
                <Modal.CloseTrigger aria-label="关闭说明">
                  <UiIcon icon={IconX} size="default" />
                </Modal.CloseTrigger>
              </Modal.Header>
              <Modal.Body>
                <p>
                  {info === "帮助中心"
                    ? "选择创作，进入模型工作台；添加参考图并描述画面。查看案例可以获取灵感，草稿会在当前页面会话中保留。"
                    : info === "账户设置"
                      ? "账户服务尚未开放。"
                      : `${info ?? "此功能"}正在准备中。`}
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onPress={() => setInfo(null)}>
                  知道了
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </motion.div>
  );
}

import { Button, Drawer, Modal, Tooltip } from "@heroui/react";
import {
  IconChevronRight,
  IconFolderSparkle,
  IconHelpCircle,
  IconLayoutSidebar,
  IconLayoutSidebarRight,
  IconMenu2,
  IconPhotoEdit,
  IconSettings,
  IconShoppingBag,
  IconSmartHome,
  IconX,
} from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { type CSSProperties, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { DialogClose } from "../components/dialog-close";
import { RouteLink } from "../components/router-link";
import { UiIcon } from "../components/ui-icon";
import { HeaderAccountMenu } from "../features/account/header-account-menu";
import { chooserModels, ModelChooserCard } from "../features/generation/models/model-chooser-card";
import { models, useStudioStore } from "../features/generation/studio-state";
import { useImageEvents } from "../features/generation/use-image-events";
import "../styles/brand.css";

const chooserLayout: CSSProperties & { "--tool-columns": number } = {
  "--tool-columns": Math.min(5, chooserModels.length),
};

export function StudioShell() {
  useImageEvents();
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
  const chooserOpen = useStudioStore((s) => s.chooserOpen);
  const setChooserOpen = useStudioStore((s) => s.setChooserOpen);
  const activeModel = useStudioStore((s) => s.activeModel);
  const setActiveModel = useStudioStore((s) => s.setActiveModel);
  const location = useLocation();
  const inWorkspace = location.pathname === "/create";
  const currentModel = inWorkspace ? models.find((m) => m.id === activeModel) : undefined;
  const navigate = useNavigate();
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
        <Button
          variant="tertiary"
          aria-label="创作"
          className={`nav-row ${chooserOpen || (currentModel && info !== "AI 电商") ? "active" : ""}`}
          onPress={() => {
            setMenuOpen(false);
            setChooserOpen(true);
          }}
          aria-haspopup="dialog"
          aria-expanded={chooserOpen}
        >
          <UiIcon icon={IconPhotoEdit} size="default" />
          <span className="nav-label">创作</span>
          <span className="nav-chevron">
            <UiIcon icon={IconChevronRight} size="small" />
          </span>
        </Button>
        <Tooltip.Content placement="right">创作</Tooltip.Content>
      </Tooltip>
      <Tooltip delay={300} isDisabled={!sidebarCollapsed}>
        <Button
          variant="tertiary"
          aria-label="AI 电商"
          className={`nav-row ${info === "AI 电商" ? "active" : ""}`}
          aria-haspopup="dialog"
          aria-expanded={info === "AI 电商"}
          onPress={() => {
            setMenuOpen(false);
            setInfo("AI 电商");
          }}
        >
          <UiIcon icon={IconShoppingBag} size="default" />
          <span className="nav-label">AI 电商</span>
          <span className="nav-chevron">
            <UiIcon icon={IconChevronRight} size="small" />
          </span>
        </Button>
        <Tooltip.Content placement="right">AI 电商</Tooltip.Content>
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
              src="/brand/lycobo-logo-white.svg"
              alt="Lycobo"
              width="88"
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
              src="/brand/lycobo-mark-white.svg"
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
                      src="/brand/lycobo-logo-white.svg"
                      alt="Lycobo"
                      width="130"
                      height="40"
                    />
                  </Drawer.Heading>
                  <Drawer.CloseTrigger aria-label="关闭导航" />
                </Drawer.Header>
                <Drawer.Body>
                  <nav>{nav}</nav>
                </Drawer.Body>
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer>
        <div className="header-actions">
          <HeaderAccountMenu />
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
      <Modal isOpen={chooserOpen} onOpenChange={setChooserOpen}>
        <Modal.Backdrop
          className="chooser-backdrop"
          data-sidebar-collapsed={sidebarCollapsed}
          data-workspace={inWorkspace || undefined}
          variant="transparent"
          style={chooserLayout}
        >
          <Modal.Container className="chooser-container" placement="top" scroll="inside">
            <Modal.Dialog className="model-chooser">
              <Modal.Header>
                <Modal.Heading>创作</Modal.Heading>
                <DialogClose label="关闭模型选择" />
              </Modal.Header>
              <Modal.Body>
                <div className="model-grid">
                  {chooserModels.map((model, index) => (
                    <ModelChooserCard
                      key={model.id}
                      model={model}
                      index={index}
                      current={Boolean(currentModel && model.id === currentModel.id)}
                      onChoose={(target) => {
                        setChooserOpen(false);
                        setActiveModel(target);
                        navigate("/create");
                      }}
                    />
                  ))}
                </div>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
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
                    : info === "通知"
                      ? "暂无通知"
                      : info === "AI 电商"
                        ? "家纺生图、换色换花型和图文合成正在准备中。你可以先使用创作。"
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

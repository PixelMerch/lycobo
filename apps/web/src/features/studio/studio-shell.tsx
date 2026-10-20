import { Button, Drawer, Modal, Tooltip } from "@heroui/react";
import "../../styles/brand.css";
import {
  IconChevronRight,
  IconFolder,
  IconHelpCircle,
  IconHome,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconMenu2,
  IconPhoto,
  IconPlayerPlay,
  IconSettings,
  IconShoppingBag,
} from "@tabler/icons-react";
import { type CSSProperties, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { RouteLink } from "../../components/router-link";
import { UiIcon } from "../../components/ui-icon";
import { useEnterpriseLogout, useEnterpriseSession } from "./auth-client";
import { CaseGallery } from "./case-gallery";
import { LoginDialog } from "./login-dialog";
import { cases, models, photo, useStudioStore } from "./studio-state";

const chooserLayout: CSSProperties & { "--tool-columns": number } = {
  "--tool-columns": Math.min(5, Math.max(models.length, cases.length)),
};

export function StudioShell() {
  const accountSession = useEnterpriseSession();
  const logout = useEnterpriseLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tkOpen, setTkOpen] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
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
          <UiIcon icon={IconHome} size="default" />
          <span className="nav-label">首页</span>
        </RouteLink>
        <Tooltip.Content placement="right">首页</Tooltip.Content>
      </Tooltip>
      <Tooltip delay={300} isDisabled={!sidebarCollapsed}>
        <Button
          variant="tertiary"
          aria-label="图片创作"
          className={`nav-row ${chooserOpen || (currentModel && !tkOpen && info !== "AI 电商") ? "active" : ""}`}
          onPress={() => {
            setMenuOpen(false);
            setChooserOpen(true);
          }}
          aria-haspopup="dialog"
          aria-expanded={chooserOpen}
        >
          <UiIcon icon={IconPhoto} size="default" />
          <span className="nav-label">图片创作</span>
          <span className="nav-chevron">
            <UiIcon icon={IconChevronRight} size="small" />
          </span>
        </Button>
        <Tooltip.Content placement="right">图片创作</Tooltip.Content>
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
        <Button
          variant="tertiary"
          aria-label="TK 专区"
          className={`nav-row ${tkOpen ? "active" : ""}`}
          aria-expanded={tkOpen}
          onPress={() => {
            setSidebarCollapsed(false);
            setTkOpen(!tkOpen);
          }}
        >
          <UiIcon icon={IconPlayerPlay} size="default" />
          <span className="nav-label">TK 专区</span>
          <span className="nav-chevron">
            <UiIcon icon={IconChevronRight} size="small" />
          </span>
        </Button>
        <Tooltip.Content placement="right">TK 专区</Tooltip.Content>
      </Tooltip>
      {tkOpen ? (
        <div className="tk-submenu">
          {[
            { name: "内容创作", items: ["带货视频", "图文转视频"] },
            { name: "内容管理", items: ["视频中心", "自动发布", "发布草稿", "发布记录"] },
            { name: "账号管理", items: ["授权账号"] },
          ].map((group) => (
            <div key={group.name}>
              <small>{group.name}</small>
              {group.items.map((item) => (
                <Button
                  key={item}
                  variant="tertiary"
                  onPress={() => {
                    setMenuOpen(false);
                    setInfo(item);
                  }}
                >
                  {item}
                </Button>
              ))}
            </div>
          ))}
        </div>
      ) : null}
      <Tooltip delay={300} isDisabled={!sidebarCollapsed}>
        <RouteLink
          nav
          to="/assets"
          aria-label="素材库"
          className="nav-row"
          onClick={() => setMenuOpen(false)}
        >
          <UiIcon icon={IconFolder} size="default" />
          <span className="nav-label">素材库</span>
        </RouteLink>
        <Tooltip.Content placement="right">素材库</Tooltip.Content>
      </Tooltip>
    </>
  );
  return (
    <div className="studio-app" data-sidebar-collapsed={sidebarCollapsed}>
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
              icon={sidebarCollapsed ? IconLayoutSidebarLeftExpand : IconLayoutSidebarLeftCollapse}
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
          {accountSession.data ? (
            <>
              <span>{accountSession.data.account}</span>
              <Button
                variant="ghost"
                size="sm"
                isPending={logout.isPending}
                onPress={() => logout.mutate()}
              >
                退出登录
              </Button>
              {logout.isError && <span role="alert">退出失败，请重试</span>}
            </>
          ) : (
            <Button
              variant="tertiary"
              size="sm"
              className="header-login"
              onPress={() => setLoginOpen(true)}
            >
              登录领积分
            </Button>
          )}
        </div>
      </header>
      {loginOpen && <LoginDialog onClose={() => setLoginOpen(false)} />}
      <main className="main-content">
        <Outlet />
      </main>
      <Modal isOpen={chooserOpen} onOpenChange={setChooserOpen}>
        <Modal.Backdrop
          className="chooser-backdrop"
          data-sidebar-collapsed={sidebarCollapsed}
          variant="transparent"
          style={chooserLayout}
        >
          <Modal.Container className="chooser-container" scroll="inside">
            <Modal.Dialog className="model-chooser">
              <Modal.Header>
                <Modal.Heading>图片创作</Modal.Heading>
                <p>选择一个模型，进入创作工作台</p>
                <Modal.CloseTrigger aria-label="关闭模型选择" />
              </Modal.Header>
              <Modal.Body>
                <div className="section-tab">模型</div>
                <div className="model-grid">
                  {models.map((model) => (
                    <Button
                      className="model-card"
                      variant="tertiary"
                      key={model.id}
                      aria-label={`进入 ${model.name} 创作`}
                      aria-current={currentModel?.id === model.id ? "true" : "false"}
                      onPress={() => {
                        setChooserOpen(false);
                        setActiveModel(model.id);
                        navigate("/create");
                      }}
                    >
                      <img src={photo(model.image, true)} alt="" width="480" height="480" />
                      <span className="model-card-body">
                        <span className="model-card-title">{model.name}</span>
                        <span className="model-card-description">{model.description}</span>
                      </span>
                    </Button>
                  ))}
                </div>
                <CaseGallery compact />
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
                <Modal.CloseTrigger aria-label="关闭说明" />
              </Modal.Header>
              <Modal.Body>
                <p>
                  {info === "帮助中心"
                    ? "选择图片创作，进入模型工作台；添加参考图并描述画面。查看案例可以获取灵感，草稿会在当前页面会话中保留。"
                    : info === "通知"
                      ? "暂无通知"
                      : info === "AI 电商"
                        ? "家纺生图、换色换花型和图文合成正在准备中。你可以先使用图片创作。"
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
    </div>
  );
}

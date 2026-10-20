import { Button, Drawer, Modal } from "@heroui/react";
import {
  IconBell,
  IconChevronRight,
  IconFolder,
  IconHelpCircle,
  IconHome,
  IconListCheck,
  IconMenu2,
  IconPhoto,
  IconPlayerPlay,
  IconSettings,
  IconShoppingBag,
  IconSparkles,
} from "@tabler/icons-react";
import { type CSSProperties, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { RouteLink } from "../../components/router-link";
import { UiIcon } from "../../components/ui-icon";
import { CaseGallery } from "./case-gallery";
import { GenerationHistory } from "./generation-history";
import { LoginDialog } from "./login-dialog";
import { cases, models, photo, useStudioStore } from "./studio-state";

const chooserLayout: CSSProperties & { "--tool-columns": number } = {
  "--tool-columns": Math.min(5, Math.max(models.length, cases.length)),
};

export function StudioShell() {
  const [menuOpen, setMenuOpen] = useState(false);
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
      <RouteLink nav to="/" end className="nav-row" onClick={() => setMenuOpen(false)}>
        <UiIcon icon={IconHome} size="navigation" />
        首页
      </RouteLink>
      <Button
        variant="tertiary"
        className={`nav-row ${chooserOpen || (currentModel && !tkOpen && info !== "AI 电商") ? "active" : ""}`}
        onPress={() => {
          setMenuOpen(false);
          setChooserOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={chooserOpen}
      >
        <UiIcon icon={IconPhoto} size="navigation" />
        图片创作
        <span className="nav-chevron">
          <UiIcon icon={IconChevronRight} size="small" />
        </span>
      </Button>
      <Button
        variant="tertiary"
        className={`nav-row ${info === "AI 电商" ? "active" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={info === "AI 电商"}
        onPress={() => {
          setMenuOpen(false);
          setInfo("AI 电商");
        }}
      >
        <UiIcon icon={IconShoppingBag} size="navigation" />
        AI 电商
        <span className="nav-chevron">
          <UiIcon icon={IconChevronRight} size="small" />
        </span>
      </Button>
      <Button
        variant="tertiary"
        className={`nav-row ${tkOpen ? "active" : ""}`}
        aria-expanded={tkOpen}
        onPress={() => setTkOpen(!tkOpen)}
      >
        <UiIcon icon={IconPlayerPlay} size="navigation" />
        TK 专区
        <span className="nav-chevron">
          <UiIcon icon={IconChevronRight} size="small" />
        </span>
      </Button>
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
      <RouteLink nav to="/assets" className="nav-row" onClick={() => setMenuOpen(false)}>
        <UiIcon icon={IconFolder} size="navigation" />
        素材库
      </RouteLink>
    </>
  );
  return (
    <div className="studio-app">
      <aside className="sidebar" aria-label="主导航">
        <RouteLink to="/" className="brand">
          <span className="brand-mark">
            <UiIcon icon={IconSparkles} size="small" />
          </span>
          lycoboai
        </RouteLink>
        <nav>{nav}</nav>
        <div className="sidebar-bottom">
          <Button variant="tertiary" className="nav-row" onPress={() => setInfo("帮助中心")}>
            <UiIcon icon={IconHelpCircle} size="navigation" />
            帮助中心
          </Button>
          <Button variant="tertiary" className="nav-row" onPress={() => setInfo("账户设置")}>
            <UiIcon icon={IconSettings} size="navigation" />
            账户设置
          </Button>
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
                  <Drawer.Heading>lycoboai</Drawer.Heading>
                  <Drawer.CloseTrigger aria-label="关闭导航" />
                </Drawer.Header>
                <Drawer.Body>
                  <nav>{nav}</nav>
                </Drawer.Body>
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer>
        <nav className="breadcrumb" aria-label="面包屑">
          <RouteLink to="/" aria-label="首页">
            <UiIcon icon={IconHome} size="default" />
          </RouteLink>
          <UiIcon icon={IconChevronRight} size="small" />
          {currentModel ? (
            <>
              <span>图片创作</span>
              <span>/</span>
              <strong>{currentModel.name}</strong>
            </>
          ) : (
            <strong>{location.pathname === "/assets" ? "素材库" : "首页"}</strong>
          )}
        </nav>
        <div className="header-actions">
          <TaskCenter />
          <Button
            isIconOnly
            variant="tertiary"
            className="icon-button"
            aria-label="通知"
            onPress={() => setInfo("通知")}
          >
            <UiIcon icon={IconBell} size="navigation" />
          </Button>
          <Button className="primary-action header-login" onPress={() => setLoginOpen(true)}>
            登录
          </Button>
        </div>
      </header>
      {loginOpen && <LoginDialog onClose={() => setLoginOpen(false)} />}
      <main className="main-content">
        <Outlet />
      </main>
      <Modal isOpen={chooserOpen} onOpenChange={setChooserOpen}>
        <Modal.Backdrop className="chooser-backdrop" variant="transparent" style={chooserLayout}>
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
                      aria-pressed={currentModel?.id === model.id}
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

function TaskCenter() {
  return (
    <Drawer>
      <Drawer.Trigger className="task-trigger neutral-button">
        <UiIcon icon={IconListCheck} size="default" />
        <span>任务中心</span>
      </Drawer.Trigger>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="task-drawer">
            <Drawer.Header>
              <Drawer.Heading>任务中心</Drawer.Heading>
              <Drawer.CloseTrigger aria-label="关闭任务中心" />
            </Drawer.Header>
            <Drawer.Body>
              <GenerationHistory compact />
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

import { Button, Drawer, Input } from "@heroui/react";
import {
  IconArrowRight,
  IconArrowUp,
  IconBell,
  IconCheck,
  IconChevronRight,
  IconCoins,
  IconDownload,
  IconFolder,
  IconGridDots,
  IconHome,
  IconListCheck,
  IconMinus,
  IconPhoto,
  IconPlus,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useParams, useSearchParams } from "react-router";
import { UiIcon } from "../../components/ui-icon";
import { AccountMenu } from "./account-menu";
import { ComposerSettings } from "./composer-settings";
import { type DemoTask, products, useDesignStore } from "./design-data";
import { ReferenceInput, ReferenceThumbnail } from "./reference-input";

function ProductShot({ shot, className = "" }: { shot: number; className?: string }) {
  return (
    <div
      className={`product-shot shot-${shot} ${className}`}
      role="img"
      aria-label={products[shot]?.title ?? "商品图片"}
    />
  );
}
function Status({ task }: { task: DemoTask }) {
  return (
    <span
      className={`task-status status-${task.status === "已完成" ? "done" : task.status === "部分失败" ? "error" : "pending"}`}
    >
      <span className="status-dot" />
      {task.unread ? "新结果" : task.status}
    </span>
  );
}
function TaskDrawer() {
  const tasks = useDesignStore((s) => s.tasks);
  const [open, setOpen] = useState(false);
  return (
    <Drawer isOpen={open} onOpenChange={setOpen}>
      <Drawer.Trigger className="pill-button task-trigger">
        <UiIcon icon={IconListCheck} size="default" />
        全部任务 <span className="count-badge">{tasks.length}</span>
      </Drawer.Trigger>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="task-drawer">
            <Drawer.Header>
              <Drawer.Heading>全部任务</Drawer.Heading>
              <p className="muted">跨项目查看，不打断当前创作</p>
              <Drawer.CloseTrigger aria-label="关闭任务抽屉" />
            </Drawer.Header>
            <Drawer.Body>
              <div className="drawer-summary">
                <span>
                  {tasks.filter((t) => t.status === "生成中" || t.status === "排队中").length}{" "}
                  个进行中
                </span>
                <span>{tasks.filter((t) => t.unread).length} 个新结果</span>
              </div>
              {tasks.map((t) => (
                <Link
                  key={t.id}
                  className="drawer-task"
                  to={`/canvas?task=${t.id}`}
                  onClick={() => setOpen(false)}
                >
                  <ProductShot shot={t.shot} />
                  <div>
                    <strong>{t.title}</strong>
                    <p>
                      <Status task={t} />
                    </p>
                    <small>{t.status === "已完成" ? "查看结果与下载" : "查看任务详情"}</small>
                  </div>
                  <UiIcon icon={IconChevronRight} size="small" />
                </Link>
              ))}
            </Drawer.Body>
            <Drawer.Footer>
              <Link className="pill-button" to="/tasks" onClick={() => setOpen(false)}>
                打开任务中心 <UiIcon icon={IconArrowRight} size="small" />
              </Link>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
function Notifications() {
  const [open, setOpen] = useState(false);
  const tasks = useDesignStore((s) => s.tasks);
  const unread = tasks.filter((t) => t.unread);
  return (
    <Drawer isOpen={open} onOpenChange={setOpen}>
      <Drawer.Trigger
        className="pill-button notification-button"
        aria-label={`通知，${unread.length} 个新结果`}
      >
        <UiIcon icon={IconBell} size="navigation" />
        {unread.length > 0 ? <span className="notification-count">{unread.length}</span> : null}
      </Drawer.Trigger>
      <Drawer.Backdrop>
        <Drawer.Content placement="right">
          <Drawer.Dialog className="task-drawer">
            <Drawer.Header>
              <Drawer.Heading>新结果</Drawer.Heading>
              <Drawer.CloseTrigger aria-label="关闭通知" />
            </Drawer.Header>
            <Drawer.Body>
              <p className="muted">结果留在这里，忙完再看。</p>
              {unread.length ? (
                unread.map((t) => (
                  <Link
                    key={t.id}
                    className="drawer-task"
                    to={`/canvas?task=${t.id}`}
                    onClick={() => setOpen(false)}
                  >
                    <ProductShot shot={t.shot} />
                    <div>
                      <strong>{t.title}</strong>
                      <p>生成完成 · 查看结果</p>
                    </div>
                  </Link>
                ))
              ) : (
                <p>结果都已查看。</p>
              )}
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}
function Composer({ compact = false, currentShot }: { compact?: boolean; currentShot?: number }) {
  const prompt = useDesignStore((s) => s.prompt);
  const shot = useDesignStore((s) => s.shot);
  const setDraft = useDesignStore((s) => s.setDraft);
  const addTask = useDesignStore((s) => s.addTask);
  const [submitted, setSubmitted] = useState<string>();
  const mode = currentShot === undefined || shot === currentShot ? "继续当前商品" : "换个商品";
  return (
    <div className={`demo-composer ${compact ? "compact" : ""}`}>
      {compact ? (
        <div className="composer-modes">
          {["继续当前商品", "换个商品"].map((m) => (
            <Button
              key={m}
              variant="tertiary"
              aria-pressed={mode === m}
              className={mode === m ? "selected" : ""}
              onPress={() => {
                if (m === "换个商品") setDraft("", (shot + 1) % products.length);
                else setDraft(prompt, currentShot ?? shot);
              }}
            >
              {m}
            </Button>
          ))}
        </div>
      ) : null}
      <ReferenceInput compact={compact} />
      <div className="demo-composer-footer">
        <ComposerSettings />
        <div className="send-control">
          <span
            className="bean-cost"
            role="img"
            aria-label="预计消耗豆子：待报价"
            title="费用将在报价后显示"
          >
            <UiIcon icon={IconCoins} size="default" />
            <span>—</span>
          </span>
          <Button
            className="send-button"
            isIconOnly
            aria-label="生成图片"
            isDisabled={!prompt.trim()}
            onPress={() => setSubmitted(addTask())}
          >
            <UiIcon icon={IconArrowUp} size="navigation" />
          </Button>
        </div>
      </div>
      {submitted ? (
        <div className="submission-note" role="status">
          <UiIcon icon={IconCheck} size="small" />
          <span>任务已加入队列，可以继续创作。</span>
          <Link to={`/canvas?task=${submitted}`}>查看</Link>
        </div>
      ) : null}
    </div>
  );
}
function Gallery({ full = false }: { full?: boolean }) {
  const [category, setCategory] = useState("全部");
  const setDraft = useDesignStore((s) => s.setDraft);
  return (
    <section className="example-section">
      <div className="section-heading">
        <div>
          <h2>{full ? "案例灵感" : "找一点灵感"}</h2>
        </div>
        <Link className="text-link" to={full ? "/" : "/inspiration"}>
          {full ? "开始创作" : "全部案例"}
          <UiIcon icon={IconArrowRight} size="small" />
        </Link>
      </div>
      <div className="filter-row">
        {["全部", "美妆个护", "服饰鞋包"].map((c) => (
          <Button
            key={c}
            variant="tertiary"
            aria-pressed={c === category}
            className={c === category ? "filter active" : "filter"}
            onPress={() => setCategory(c)}
          >
            {c}
          </Button>
        ))}
      </div>
      <div className="example-grid">
        {products
          .filter((p) => category === "全部" || p.category === category)
          .map((p) => (
            <Link
              key={p.id}
              className="example-card"
              to="/"
              onClick={() => setDraft(p.description, p.shot)}
            >
              <ProductShot shot={p.shot} />
              <div className="example-caption">
                <span>{p.title}</span>
                <span className="example-action">
                  做同款 <UiIcon icon={IconArrowRight} size="small" />
                </span>
              </div>
            </Link>
          ))}
      </div>
    </section>
  );
}
function DesignHome() {
  const tasks = useDesignStore((s) => s.tasks);
  return (
    <>
      <section className="design-hero">
        <div className="hero-heading">
          <h1>好商品，值得一张好图</h1>
          <p>参考图 + 描述，开始创作。</p>
        </div>
        <Composer />
        <div className="quick-actions">
          <Link to="/canvas" className="pill-button">
            <UiIcon icon={IconGridDots} size="default" />
            自由画布
          </Link>
          <Button
            variant="tertiary"
            onPress={() => useDesignStore.getState().setDraft(products[0].description, 0)}
          >
            商品场景
          </Button>
          <Button
            variant="tertiary"
            onPress={() => useDesignStore.getState().setDraft(products[2].description, 2)}
          >
            服饰鞋包
          </Button>
          <Button
            variant="tertiary"
            onPress={() => useDesignStore.getState().setDraft(products[1].description, 1)}
          >
            质感主图
          </Button>
        </div>
      </section>
      <section className="ongoing-section">
        <div className="section-heading">
          <h2>最近创作</h2>
          <Link className="text-link" to="/tasks">
            全部任务 <UiIcon icon={IconArrowRight} size="small" />
          </Link>
        </div>
        <div className="ongoing-grid">
          {tasks.slice(0, 3).map((t) => (
            <Link className="ongoing-task" key={t.id} to={`/canvas?task=${t.id}`}>
              <ProductShot shot={t.shot} />
              <span>
                <strong>{t.title}</strong>
                <Status task={t} />
              </span>
              <UiIcon icon={IconChevronRight} size="small" />
            </Link>
          ))}
        </div>
      </section>
      <Gallery />
    </>
  );
}
function DesignTasks() {
  const tasks = useDesignStore((s) => s.tasks);
  const [filter, setFilter] = useState("全部任务");
  const [search, setSearch] = useState("");
  const visible = tasks.filter(
    (t) =>
      (!search || `${t.title} ${t.prompt}`.includes(search)) &&
      (filter === "全部任务" ||
        (filter === "新结果" && t.unread) ||
        (filter === "进行中" && ["生成中", "排队中"].includes(t.status)) ||
        (filter === "已完成" && t.status === "已完成") ||
        (filter === "异常" && t.status === "部分失败")),
  );
  return (
    <section className="design-task-page">
      <div className="page-heading">
        <div>
          <h1>任务中心</h1>
          <p>每一次创作，都能在这里找回。</p>
        </div>
        <Link className="pill-button primary-link" to="/">
          <UiIcon icon={IconPlus} size="default" />
          新建创作
        </Link>
      </div>
      <div className="tasks-toolbar">
        <div className="filter-row">
          {["全部任务", "进行中", "新结果", "已完成", "异常"].map((f) => (
            <Button
              variant="tertiary"
              key={f}
              aria-pressed={filter === f}
              className={filter === f ? "filter active" : "filter"}
              onPress={() => setFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>
        <div className="task-search">
          <UiIcon icon={IconSearch} size="default" />
          <Input
            aria-label="搜索任务"
            placeholder="搜索商品、描述"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <p className="list-count">{visible.length} 个任务</p>
      <div className="task-list">
        {visible.map((t) => (
          <div className="task-row" key={t.id}>
            <ProductShot shot={t.shot} />
            <div className="task-row-title">
              <Link to={`/canvas?task=${t.id}`}>{t.title}</Link>
              <p>{t.prompt}</p>
            </div>
            <Status task={t} />
            <span className="task-detail">
              {t.status === "已完成"
                ? "1 张结果"
                : t.status === "部分失败"
                  ? "结果待重试"
                  : "后台处理中"}
            </span>
            <Link className="pill-button" to={`/canvas?task=${t.id}`}>
              查看任务
              <UiIcon icon={IconArrowRight} size="small" />
            </Link>
          </div>
        ))}
      </div>
      {!visible.length ? (
        <div className="empty-state">
          <UiIcon icon={IconSearch} size="illustration" />
          <h2>没有找到匹配任务</h2>
          <p>换个关键词，或切换筛选条件。</p>
        </div>
      ) : null}
    </section>
  );
}
function DesignLibrary({ view }: { view: string }) {
  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>{view === "projects" ? "我的项目" : "作品库"}</h1>
          <p>
            {view === "projects"
              ? "按商品归档，接着上一次的画布继续创作。"
              : "查看图片，进入画布继续调整。"}
          </p>
        </div>
        <Link to="/" className="pill-button">
          <UiIcon icon={IconPlus} size="default" />
          新建创作
        </Link>
      </div>
      <div className="library-grid">
        {products.map((p) => (
          <Link to={`/canvas?shot=${p.shot}`} className="library-card" key={p.id}>
            <ProductShot shot={p.shot} />
            <div>
              <h2>{p.title}</h2>
            </div>
            <UiIcon icon={IconArrowRight} size="small" />
          </Link>
        ))}
      </div>
    </section>
  );
}
function DesignCanvas() {
  const tasks = useDesignStore((s) => s.tasks);
  const markRead = useDesignStore((s) => s.markRead);
  const setDraft = useDesignStore((s) => s.setDraft);
  const [search] = useSearchParams();
  const selected =
    tasks.find((t) => t.id === search.get("task")) ??
    tasks.find((t) => t.shot === Number(search.get("shot") ?? 0));
  const task = selected ?? tasks[0];
  const [zoom, setZoom] = useState(100);
  const [edit, setEdit] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [downloadError, setDownloadError] = useState("");
  const taskId = task?.id;
  useEffect(() => {
    if (taskId) markRead(taskId);
  }, [taskId, markRead]);
  if (!task) return null;
  const ready = task.status === "已完成";
  async function download() {
    if (!task) return;
    try {
      const source = new Image();
      source.src = "/design/product-studies.png";
      await source.decode();
      const canvas = document.createElement("canvas");
      const side = Math.floor(source.naturalWidth / 2);
      canvas.width = side;
      canvas.height = side;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas-unavailable");
      ctx.filter = `brightness(${brightness}%)`;
      ctx.drawImage(
        source,
        (task.shot % 2) * side,
        Math.floor(task.shot / 2) * side,
        side,
        side,
        0,
        0,
        side,
        side,
      );
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("export-failed"))), "image/png"),
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `lycoboai-${task.title}.png`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadError("");
    } catch {
      setDownloadError("导出失败，请重试。");
    }
  }
  return (
    <div className="canvas-workbench">
      <a className="skip-link" href="#canvas-main">
        跳转到画布
      </a>
      <header className="canvas-topbar">
        <div className="project-capsule">
          <Link className="canvas-brand" to="/" aria-label="返回创作首页">
            lyco<span>·</span>
          </Link>
          <span>{task.title}</span>
        </div>
        <div className="canvas-header-actions">
          <TaskDrawer />
          <Notifications />
          <AccountMenu />
        </div>
      </header>
      <main id="canvas-main" className="canvas-main">
        <div className="canvas-floating-tools">
          <Link className="pill-button" to="/">
            <UiIcon icon={IconPlus} size="default" />
            新建创作
          </Link>
          <Link className="pill-button" to="/projects">
            <UiIcon icon={IconFolder} size="default" />
            项目
          </Link>
        </div>
        <div className="canvas-artboard" style={{ transform: `scale(${zoom / 100})` }}>
          <div className="artboard-title">
            <span>{ready ? "场景主图" : "商品参考"}</span>
            <span>{ready ? "627 × 627" : "等待生成结果"}</span>
          </div>
          <div
            className={`artboard-image ${edit ? "editing" : ""}`}
            style={{ filter: `brightness(${brightness}%)` }}
          >
            <ProductShot shot={task.shot} />
          </div>
          {ready ? (
            <div className="image-actions">
              <Button variant="secondary" onPress={() => setEdit((v) => !v)}>
                调整图片
              </Button>
              <Button
                variant="secondary"
                onPress={() => {
                  setDraft(task.prompt, task.shot);
                  if (task.references) useDesignStore.getState().setReferences(task.references);
                }}
              >
                作为参考
              </Button>
              <Button variant="secondary" onPress={() => void download()}>
                <UiIcon icon={IconDownload} size="default" />
                下载图片
              </Button>
            </div>
          ) : (
            <p className="canvas-waiting">
              <Status task={task} />
              可以继续处理其他商品
            </p>
          )}
        </div>
        <div className="zoom-controls">
          <Button
            isIconOnly
            variant="tertiary"
            aria-label="缩小画布"
            isDisabled={zoom <= 50}
            onPress={() => setZoom((v) => v - 10)}
          >
            <UiIcon icon={IconMinus} size="default" />
          </Button>
          <Button variant="tertiary" onPress={() => setZoom(100)}>
            {zoom}%
          </Button>
          <Button
            isIconOnly
            variant="tertiary"
            aria-label="放大画布"
            isDisabled={zoom >= 130}
            onPress={() => setZoom((v) => v + 10)}
          >
            <UiIcon icon={IconPlus} size="default" />
          </Button>
        </div>
      </main>
      <aside className="canvas-panel">
        <div className="panel-heading">
          <h1>{edit ? "调整图片" : "创作记录"}</h1>
          <span className="muted">当前项目</span>
          {edit ? (
            <Button
              isIconOnly
              variant="tertiary"
              aria-label="关闭调整"
              onPress={() => setEdit(false)}
            >
              <UiIcon icon={IconX} size="default" />
            </Button>
          ) : null}
        </div>
        <div className="canvas-history">
          {edit ? (
            <div className="edit-settings">
              <label htmlFor="brightness">
                亮度 <span>{brightness}%</span>
              </label>
              <input
                id="brightness"
                type="range"
                min="60"
                max="140"
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
              />
              <p className="muted">原素材保持不变，下载包含本次亮度调整。</p>
              <Button variant="secondary" onPress={() => setBrightness(100)}>
                重置调整
              </Button>
            </div>
          ) : (
            <>
              <div className="history-reference">
                {task.references ? (
                  task.references.map((image) => (
                    <ReferenceThumbnail key={image.id} image={image} />
                  ))
                ) : (
                  <ProductShot shot={task.shot} />
                )}
                <span>
                  参考图
                  <small>{task.references ? `${task.references.length} 张` : "商品外观参考"}</small>
                </span>
              </div>
              <p className="history-prompt">{task.prompt}</p>
              {task.settings ? (
                <p className="muted">
                  {task.settings.model} · {task.settings.ratio} · {task.settings.resolution} ·{" "}
                  {task.settings.count}
                </p>
              ) : null}
              <div className="history-result">
                <Status task={task} />
                <p>
                  {ready
                    ? "结果已放到画布，可以调整、下载，或用作下一轮参考。"
                    : task.status === "部分失败"
                      ? "部分图片生成失败，参考图已保留。"
                      : "任务在后台处理。你可以直接换个商品继续创作。"}
                </p>
                {ready ? (
                  <ProductShot shot={task.shot} />
                ) : (
                  <div className="waiting-stages">
                    <span>
                      <UiIcon icon={IconCheck} size="small" />
                      已提交
                    </span>
                    <span>等待结果</span>
                  </div>
                )}
              </div>
            </>
          )}
          {downloadError ? (
            <p role="alert" className="field-error">
              {downloadError}
            </p>
          ) : null}
        </div>
        <Composer compact currentShot={task.shot} />
      </aside>
    </div>
  );
}
export function DesignPage() {
  const { view } = useParams();
  const [search] = useSearchParams();
  if (view === "canvas") return <DesignCanvas key={search.toString()} />;
  return (
    <div className="app-shell design-shell">
      <a className="skip-link" href="#design-main">
        跳转到主要内容
      </a>
      <aside className="sidebar">
        <Link to="/" className="brand">
          lycoboai<span className="brand-period">·</span>
        </Link>
        <Link to="/" className="new-project">
          <UiIcon icon={IconPlus} size="default" />
          新建创作
        </Link>
        <nav aria-label="主导航">
          {[
            { path: "", label: "创作工作室", Icon: IconHome },
            { path: "tasks", label: "任务中心", Icon: IconListCheck },
            { path: "inspiration", label: "案例灵感", Icon: IconGridDots },
            { path: "assets", label: "作品库", Icon: IconPhoto },
            { path: "projects", label: "我的项目", Icon: IconFolder },
          ].map(({ path, label, Icon }) => (
            <NavLink
              end
              key={path}
              to={`/${path}`}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            >
              <UiIcon icon={Icon} size="navigation" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-projects">
          <p>
            最近项目 <UiIcon icon={IconChevronRight} size="small" />
          </p>
          {products.slice(0, 3).map((p) => (
            <Link key={p.id} to={`/canvas?shot=${p.shot}`}>
              <ProductShot shot={p.shot} />
              <span>{p.title}</span>
            </Link>
          ))}
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-actions">
            <TaskDrawer />
            <Notifications />
            <AccountMenu />
          </div>
        </header>
        <main id="design-main" className="main-content">
          {view === "tasks" ? (
            <DesignTasks />
          ) : view === "inspiration" ? (
            <Gallery full />
          ) : view === "projects" || view === "assets" ? (
            <DesignLibrary view={view} />
          ) : (
            <DesignHome />
          )}
        </main>
      </div>
    </div>
  );
}

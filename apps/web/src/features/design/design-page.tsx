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
  IconPhoto,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate, useParams, useSearchParams } from "react-router";
import { UiIcon } from "../../components/ui-icon";
import { AccountMenu } from "./account-menu";
import { ComposerSettings, ParameterFields } from "./composer-settings";
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
  const hasUpload = useDesignStore((s) => s.references.some((image) => Boolean(image.src)));
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
            isDisabled={!prompt.trim() && !hasUpload}
            onPress={() => {
              const id = addTask();
              setSubmitted(id);
            }}
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
          <h2 style={full ? undefined : { marginTop: 12 }}>{full ? "案例灵感" : "找一点灵感"}</h2>
        </div>
        {full ? (
          <Link className="text-link" to="/">
            开始创作
            <UiIcon icon={IconArrowRight} size="small" />
          </Link>
        ) : null}
      </div>
      {full ? (
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
      ) : null}
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
  return (
    <>
      <section className="design-hero">
        <div className="hero-heading">
          <h1>一张好图，让好商品更动人</h1>
          <p>上传参考图、描述构想，瞬间生成专属好图。</p>
        </div>
        <Composer />
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
          <h1>历史记录</h1>
          <p>之前生成的图片，都在这里找回。</p>
        </div>
        <Link className="pill-button primary-link" to="/">
          <UiIcon icon={IconPlus} size="default" />
          开始创作
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
          <h1>{view === "projects" ? "我的项目" : "素材库"}</h1>
          <p>
            {view === "projects"
              ? "按商品归档，接着上一次的画布继续创作。"
              : "保存过的商品图和参考图，随时可以继续使用。"}
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
  const addTask = useDesignStore((s) => s.addTask);
  const prompt = useDesignStore((s) => s.prompt);
  const references = useDesignStore((s) => s.references);
  const [search] = useSearchParams();
  const selected =
    tasks.find((t) => t.id === search.get("task")) ??
    tasks.find((t) => t.shot === Number(search.get("shot") ?? 0));
  const [activeId, setActiveId] = useState(selected?.id ?? tasks[0]?.id);
  const [contextId, setContextId] = useState(selected?.id ?? tasks[0]?.id);
  const previews = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string>();
  const [brightness, setBrightness] = useState(100);
  const [downloadError, setDownloadError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const feed = useRef<HTMLDivElement>(null);
  const records = useRef(new Map<string, HTMLElement>());
  const taskId = selected?.id;

  // URL navigation and thumbnail navigation target the same result list.
  useEffect(() => {
    if (taskId) {
      if (window.matchMedia("(min-width: 851px)").matches) {
        records.current.get(taskId)?.scrollIntoView({ block: "start" });
      }
      setActiveId(taskId);
      setContextId(taskId);
      markRead(taskId);
    }
  }, [taskId, markRead]);

  useEffect(() => {
    const list = feed.current;
    function syncVisibleRecord() {
      const desktop = window.matchMedia("(min-width: 851px)").matches;
      const top = desktop ? (list?.getBoundingClientRect().top ?? 0) : 0;
      const bottom = desktop
        ? (list?.getBoundingClientRect().bottom ?? window.innerHeight)
        : window.innerHeight;
      const visible = [...records.current.entries()]
        .map(([id, element]) => ({ id, rect: element.getBoundingClientRect() }))
        .filter(({ rect }) => rect.bottom > top + 1 && rect.top < bottom)
        .sort((a, b) => Math.abs(a.rect.top - top) - Math.abs(b.rect.top - top))[0];
      if (visible) {
        setActiveId(visible.id);
        markRead(visible.id);
      }
    }
    list?.addEventListener("scroll", syncVisibleRecord, { passive: true });
    window.addEventListener("scroll", syncVisibleRecord, { passive: true });
    return () => {
      list?.removeEventListener("scroll", syncVisibleRecord);
      window.removeEventListener("scroll", syncVisibleRecord);
    };
  }, [markRead]);

  useEffect(() => {
    if (!activeId) return;
    const list = previews.current;
    const thumbnail = list?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!list || !thumbnail) return;
    const bounds = list.getBoundingClientRect();
    const item = thumbnail.getBoundingClientRect();
    const horizontal = window.matchMedia("(max-width: 850px)").matches;
    if (horizontal) {
      if (item.left < bounds.left || item.right > bounds.right)
        list.scrollBy({ left: item.left - bounds.left });
    } else if (item.top < bounds.top || item.bottom > bounds.bottom) {
      list.scrollBy({ top: item.top - bounds.top });
    }
  }, [activeId]);

  function locate(id: string) {
    setActiveId(id);
    markRead(id);
    const record = records.current.get(id);
    record?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    record?.focus({ preventScroll: true });
  }

  function continueTask(item: DemoTask) {
    setContextId(item.id);
    setDraft("", item.shot);
    if (item.references) useDesignStore.getState().setReferences(item.references);
    if (item.settings) useDesignStore.getState().setSettings(item.settings);
    document.getElementById("canvas-prompt")?.focus();
  }
  async function downloadResult(task: DemoTask) {
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
      ctx.filter = `brightness(${task.id === editingId ? brightness : 100}%)`;
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
    <div className="generation-studio">
      <a className="skip-link" href="#generation-feed">
        跳转到生成记录
      </a>
      <header className="studio-header">
        <Link className="brand" to="/">
          lycoboai<span className="brand-period">·</span>
        </Link>
        <span className="studio-title">图片创作</span>
        <div className="studio-header-actions">
          <TaskDrawer />
          <Notifications />
          <AccountMenu />
        </div>
      </header>
      <nav className="studio-nav" aria-label="主导航">
        <Link className="nav-item" to="/">
          <UiIcon icon={IconHome} size="navigation" />
          首页
        </Link>
        <Link className="nav-item active" aria-current="page" to="/canvas">
          <UiIcon icon={IconPhoto} size="navigation" />
          图片创作
        </Link>
        <Link className="nav-item" to="/assets">
          <UiIcon icon={IconFolder} size="navigation" />
          作品库
        </Link>
        <Link className="nav-item" to="/inspiration">
          <UiIcon icon={IconGridDots} size="navigation" />
          案例灵感
        </Link>
        <Link className="nav-item" to="/projects">
          <UiIcon icon={IconFolder} size="navigation" />
          我的项目
        </Link>
      </nav>
      <aside className="studio-input" aria-label="创作功能区">
        <div className="studio-input-heading">
          <h1>图片创作</h1>
          <p>上传参考图，描述你想要的画面</p>
        </div>
        <div className="studio-parameters">
          <ComposerSettings controlSize="navigation" modelOnly />
        </div>
        <div className="studio-submit">
          <div className="studio-reference-input">
            <h2>
              提示词 <span>参考图最多 5 张</span>
            </h2>
            <ReferenceInput compact />
          </div>
          <div className="studio-inline-settings">
            <ParameterFields />
          </div>
          <Button
            className="studio-generate"
            aria-label="生成图片"
            isDisabled={!prompt.trim() && !references.some((image) => image.src)}
            onPress={() => {
              const id = addTask(contextId);
              setContextId(id);
              setSubmitted(true);
              setActiveId(id);
              requestAnimationFrame(() => {
                records.current.get(id)?.scrollIntoView({ block: "start", behavior: "instant" });
                document.getElementById("canvas-prompt")?.focus({ preventScroll: true });
              });
            }}
          >
            <UiIcon icon={IconArrowUp} size="navigation" />
            生成图片
          </Button>
          <span className="studio-cost">
            <UiIcon icon={IconCoins} size="small" />
            预计消耗 —
          </span>
          <p className="submission-note" role="status">
            {submitted ? "任务已加入队列，可以继续创作。" : ""}
          </p>
        </div>
      </aside>
      <main className="studio-results" aria-label="图片生成记录">
        <div className="studio-feed-heading">
          <h2>
            生成记录 <span>{tasks.length}</span>
          </h2>
          <Link className="pill-button" to="/inspiration">
            案例灵感
            <UiIcon icon={IconChevronRight} size="small" />
          </Link>
        </div>
        <div className="generation-feed" id="generation-feed" ref={feed}>
          {tasks.map((item) => {
            const ready = item.status === "已完成";
            const isEditing = editingId === item.id;
            const source = item.references?.find((image) => image.src) ?? item.references?.[0];
            return (
              <article
                key={item.id}
                className="generation-record"
                data-active={activeId === item.id}
                data-task-id={item.id}
                tabIndex={-1}
                aria-label={`${item.title} · ${item.prompt || "参考图片创作"}`}
                ref={(element) => {
                  if (element) records.current.set(item.id, element);
                  else records.current.delete(item.id);
                }}
              >
                <header className="record-heading">
                  <h3>{item.title}</h3>
                  <Status task={item} />
                </header>
                <div className="record-settings">
                  <span className="record-model">{item.settings?.model ?? "模型未记录"}</span>
                  <time dateTime={item.createdAt}>
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleString("zh-CN", { hour12: false })
                      : "时间未记录"}
                  </time>
                  <span className="record-task-id" title={item.id}>
                    任务 ID：{item.id}
                  </span>
                  <span className="record-ratio" title="图片比例">
                    {item.settings?.ratio ?? "—"}
                  </span>
                  <span className="record-resolution" title="分辨率">
                    {item.settings?.resolution ?? "—"}
                  </span>
                  <span className="record-count" title="生成张数">
                    {item.settings?.count ?? "—"}
                  </span>
                </div>
                <p className="history-prompt">{item.prompt || "使用上传的参考图片进行创作"}</p>
                {item.references?.length ? (
                  <div className="history-reference">
                    {item.references.map((image) => (
                      <ReferenceThumbnail key={image.id} image={image} />
                    ))}
                  </div>
                ) : null}
                {ready ? (
                  <>
                    <div
                      className="record-result"
                      style={{ filter: `brightness(${isEditing ? brightness : 100}%)` }}
                    >
                      <ProductShot shot={item.shot} />
                    </div>
                    <div className="record-actions">
                      <Button variant="secondary" onPress={() => continueTask(item)}>
                        继续修改
                      </Button>
                      <Button
                        variant="tertiary"
                        onPress={() => {
                          setEditingId(isEditing ? undefined : item.id);
                          setBrightness(100);
                        }}
                      >
                        调整图片
                      </Button>
                      <Button
                        variant="tertiary"
                        onPress={() => {
                          void downloadResult(item);
                        }}
                      >
                        <UiIcon icon={IconDownload} size="default" />
                        下载图片
                      </Button>
                    </div>
                    {isEditing ? (
                      <div className="record-adjustment">
                        <label htmlFor={`brightness-${item.id}`}>亮度 {brightness}%</label>
                        <input
                          id={`brightness-${item.id}`}
                          type="range"
                          min="60"
                          max="140"
                          value={brightness}
                          onChange={(event) => setBrightness(Number(event.target.value))}
                        />
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="record-pending">
                    {source ? (
                      <div className="record-source">
                        <ReferenceThumbnail image={source} />
                        <span>商品参考</span>
                      </div>
                    ) : (
                      <UiIcon icon={IconPhoto} size="illustration" />
                    )}
                    <div>
                      <strong>
                        {item.status === "部分失败" ? "部分图片未能生成" : "等待生成结果"}
                      </strong>
                      <p>
                        {item.status === "部分失败"
                          ? "参考图与描述已保留，可继续修改。"
                          : "参考图与描述已保留，可以继续输入下一轮要求。"}
                      </p>
                      <Button variant="tertiary" onPress={() => continueTask(item)}>
                        继续修改
                      </Button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
        {downloadError ? (
          <p role="alert" className="field-error">
            {downloadError}
          </p>
        ) : null}
      </main>
      <aside className="studio-previews" aria-label="历史预览">
        <h2>历史记录</h2>
        <div className="studio-preview-list" ref={previews}>
          {tasks.map((item, index) => (
            <Button
              variant="tertiary"
              key={item.id}
              className="studio-preview"
              aria-label={`定位记录 ${index + 1}：${item.title}`}
              aria-pressed={activeId === item.id}
              onPress={() => locate(item.id)}
            >
              {item.status === "已完成" ? (
                <ProductShot shot={item.shot} />
              ) : item.references?.[0] ? (
                <ReferenceThumbnail image={item.references[0]} />
              ) : (
                <UiIcon icon={IconPhoto} size="action" />
              )}
              <span>{item.status}</span>
            </Button>
          ))}
        </div>
      </aside>
    </div>
  );
}

export function DesignPage() {
  const { view } = useParams();
  if (view === "canvas") return <DesignCanvas />;
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
            { path: "", label: "图片创作", Icon: IconHome },
            { path: "history", label: "历史记录", Icon: IconListCheck },
            { path: "assets", label: "素材库", Icon: IconPhoto },
            { path: "templates", label: "模板灵感", Icon: IconGridDots },
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
          {view === "tasks" || view === "history" ? (
            <DesignTasks />
          ) : view === "inspiration" || view === "templates" ? (
            <Gallery full />
          ) : view === "projects" || view === "assets" || view === "library" ? (
            <DesignLibrary view={view} />
          ) : (
            <DesignHome />
          )}
        </main>
      </div>
    </div>
  );
}

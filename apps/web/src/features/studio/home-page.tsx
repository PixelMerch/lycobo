import {
  Alert,
  Button,
  Card,
  ListBox,
  Modal,
  Select,
  Spinner,
  TextArea,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import {
  IconArrowRight,
  IconArrowUpRight,
  IconBox,
  IconPhoto,
  IconSparkles,
  IconTextCaption,
} from "@tabler/icons-react";
import { lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router";
import { RouteLink } from "../../components/router-link";
import { UiIcon } from "../../components/ui-icon";
import { useEnterpriseSession } from "./auth-client";
import { type CommerceCase, commerceCases } from "./commerce-cases";
import { assetContentUrl, useImageAssets, useImageSession } from "./generation-client";
import { ReferencePicker } from "./reference-picker";
import { useStudioStore } from "./studio-state";
import "../../styles/home.css";

const LoginDialog = lazy(() =>
  import("./login-dialog").then((module) => ({ default: module.LoginDialog })),
);
const purposes = ["全部", "商品主图", "场景图", "创意海报"];
const categories = ["全部品类", "美妆个护", "服饰箱包", "食品饮料", "家居家纺"];
const shortcuts = [
  {
    name: "商品主图",
    icon: IconPhoto,
    prompt: "保留参考商品的外观和细节，生成一张干净的电商商品主图。",
  },
  {
    name: "场景图",
    icon: IconBox,
    prompt: "保留参考商品的外观和细节，为商品搭配真实自然的使用场景。",
  },
  {
    name: "创意海报",
    icon: IconTextCaption,
    prompt: "保留参考商品的外观和细节，创作一张突出商品的商业海报。",
  },
  { name: "自由创作", icon: IconSparkles, prompt: "" },
];

export function HomePage() {
  const model = useStudioStore((s) => s.activeModel);
  const draft = useStudioStore((s) => s.drafts[model]);
  const updateDraft = useStudioStore((s) => s.updateDraft);
  const setChooserOpen = useStudioStore((s) => s.setChooserOpen);
  const identity = useEnterpriseSession();
  const navigate = useNavigate();
  const [purpose, setPurpose] = useState("全部");
  const [category, setCategory] = useState("全部品类");
  const [selected, setSelected] = useState<CommerceCase | null>(null);
  const [replace, setReplace] = useState(false);
  const [login, setLogin] = useState(false);
  const [guide, setGuide] = useState<string | null>(null);
  const filtered = commerceCases.filter(
    (item) =>
      (purpose === "全部" || item.use === purpose) &&
      (category === "全部品类" || item.category === category),
  );
  function start(prompt?: string) {
    // The homepage edits the same draft. Entering the workspace never submits paid work.
    if (prompt && !draft.prompt.trim()) updateDraft(model, { prompt });
    navigate("/create");
  }
  function applyCase() {
    if (!selected) return;
    updateDraft(model, { prompt: selected.prompt });
    setSelected(null);
    setReplace(false);
    navigate("/create");
  }
  return (
    <section className="commerce-home page-panel">
      <section className="home-start" aria-labelledby="home-title">
        <h1 id="home-title">为你的商品，创作下一张好图</h1>
        <div className="home-composer">
          <TextField className="home-prompt" aria-label="创作需求">
            <TextArea
              aria-label="创作需求"
              value={draft.prompt}
              onChange={(event) => updateDraft(model, { prompt: event.target.value })}
              placeholder="上传商品图片，描述你想要的画面"
              maxLength={9000}
            />
          </TextField>
          {!draft.prompt && (
            <p className="home-prompt-example">例如：保留香水瓶身与标签，生成自然光商品主图</p>
          )}
          <div className="home-composer-tools">
            <div className="home-upload">
              <ReferencePicker model={model} references={draft.references} compact />
            </div>
            <Button
              size="sm"
              variant="outline"
              aria-label="选择创作模型"
              onPress={() => setChooserOpen(true)}
            >
              图片创作 <UiIcon icon={IconArrowRight} size="small" />
            </Button>
            <Button className="primary-action home-start-button" onPress={() => start()}>
              开始创作 <UiIcon icon={IconArrowRight} size="default" />
            </Button>
          </div>
        </div>
        <section className="home-shortcuts" aria-label="创作用途">
          {shortcuts.map((item) => (
            <Button variant="ghost" key={item.name} onPress={() => start(item.prompt)}>
              <UiIcon icon={item.icon} size="action" />
              {item.name}
            </Button>
          ))}
        </section>
      </section>
      <section className="commerce-examples" aria-labelledby="examples-title">
        <div className="home-section-heading">
          <h2 id="examples-title">电商案例</h2>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => {
              setPurpose("全部");
              setCategory("全部品类");
            }}
          >
            查看全部 <UiIcon icon={IconArrowRight} size="small" />
          </Button>
        </div>
        <div className="home-case-filters">
          <ToggleButtonGroup
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[purpose]}
            onSelectionChange={(keys) => {
              const key = [...keys][0];
              if (typeof key === "string") setPurpose(key);
            }}
            aria-label="案例用途"
          >
            {purposes.map((item) => (
              <ToggleButton size="sm" id={item} key={item}>
                {item}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Select
            className="home-category"
            aria-label="商品品类"
            value={category}
            onChange={(key) => {
              if (typeof key === "string") setCategory(key);
            }}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {categories.map((item) => (
                  <ListBox.Item id={item} key={item} textValue={item}>
                    {item}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </div>
        <div className="commerce-case-grid">
          {filtered.map((item) => (
            <Card className="commerce-case" key={item.id}>
              <Button
                variant="ghost"
                className="commerce-case-cover"
                aria-label={`查看案例：${item.title}`}
                onPress={() => {
                  setSelected(item);
                  setReplace(false);
                }}
              >
                <CasePhoto item={item} />
                <span className="case-original">
                  <CasePhoto item={item} original />
                  <span>参考图</span>
                </span>
              </Button>
              <Card.Content>
                <Card.Title>{item.title}</Card.Title>
                <div className="commerce-case-footer">
                  <Card.Description>{item.description}</Card.Description>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`做同款：${item.title}`}
                    onPress={() => {
                      setSelected(item);
                      setReplace(false);
                    }}
                  >
                    做同款 <UiIcon icon={IconArrowUpRight} size="small" />
                  </Button>
                </div>
              </Card.Content>
            </Card>
          ))}
        </div>
        {!filtered.length && (
          <p className="home-empty-filter" role="status">
            这个分类还没有案例，试试其他品类或查看全部。
          </p>
        )}
      </section>
      <section className="home-recent" aria-labelledby="recent-title">
        <div className="home-section-heading">
          <h2 id="recent-title">最近作品</h2>
          {identity.data ? (
            <RouteLink to="/assets">
              查看全部 <UiIcon icon={IconArrowRight} size="small" />
            </RouteLink>
          ) : (
            <span>登录后查看你的创作记录</span>
          )}
        </div>
        {identity.isPending ? (
          <p role="status">正在读取登录状态…</p>
        ) : identity.isError ? (
          <p role="alert">
            登录状态暂时无法读取，
            <Button
              size="sm"
              variant="ghost"
              onPress={() => {
                void identity.refetch();
              }}
            >
              重试
            </Button>
          </p>
        ) : identity.data ? (
          <RecentWorks />
        ) : (
          <div className="home-recent-empty">
            <UiIcon icon={IconPhoto} size="illustration" />
            <p>你的商品创作，从这里开始</p>
            <Button className="home-login" onPress={() => setLogin(true)}>
              登录查看
            </Button>
          </div>
        )}
      </section>
      <footer className="home-guides">
        <Button size="sm" variant="ghost" onPress={() => setGuide("参考图上传指南")}>
          参考图上传指南
        </Button>
        <Button size="sm" variant="ghost" onPress={() => setGuide("如何保持商品一致性")}>
          如何保持商品一致性
        </Button>
      </footer>
      <Modal
        isOpen={selected !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setReplace(false);
          }
        }}
      >
        <Modal.Backdrop>
          <Modal.Container scroll="inside">
            <Modal.Dialog className="commerce-case-dialog">
              <Modal.Header>
                <Modal.Heading>{selected?.title}</Modal.Heading>
                <Modal.CloseTrigger aria-label="关闭案例" />
              </Modal.Header>
              <Modal.Body>
                {selected && (
                  <>
                    <div className="commerce-detail-photo">
                      <CasePhoto item={selected} />
                    </div>
                    <p>{selected.prompt}</p>
                    <p className="muted">
                      上传你自己的商品图，再使用这段提示词创作。案例图片不会自动加入参考图。
                    </p>
                    {replace ? (
                      <Alert status="warning" role="alert">
                        <Alert.Content>
                          <Alert.Description>
                            当前模型已有草稿，是否替换提示词？已上传的参考图会保留。
                          </Alert.Description>
                          <div className="history-confirm-actions">
                            <Button variant="secondary" onPress={() => setReplace(false)}>
                              保留草稿
                            </Button>
                            <Button className="primary-action" onPress={applyCase}>
                              替换并进入
                            </Button>
                          </div>
                        </Alert.Content>
                      </Alert>
                    ) : (
                      <Button
                        className="primary-action"
                        onPress={() => {
                          if (draft.prompt.trim()) setReplace(true);
                          else applyCase();
                        }}
                      >
                        用这个提示词创作
                      </Button>
                    )}
                  </>
                )}
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      <Modal
        isOpen={guide !== null}
        onOpenChange={(open) => {
          if (!open) setGuide(null);
        }}
      >
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>{guide}</Modal.Heading>
                <Modal.CloseTrigger aria-label="关闭指南" />
              </Modal.Header>
              <Modal.Body>
                <p>
                  {guide === "参考图上传指南"
                    ? "支持 PNG、JPEG 和 WebP，单张不超过 10MB，最多添加 5 张。优先上传清晰、无遮挡的商品图。参考图会在你确认生成时上传。"
                    : "使用清晰的商品正面图，在提示词中明确需要保留的形状、颜色、标签和材质。先检查生成结果，再用于商品展示；复杂文字与细节需要逐项核对。"}
                </p>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      {login && (
        <Suspense fallback={<p role="status">正在打开登录…</p>}>
          <LoginDialog onClose={() => setLogin(false)} />
        </Suspense>
      )}
    </section>
  );
}
function CasePhoto({ item, original = false }: { item: CommerceCase; original?: boolean }) {
  return (
    <span
      className="commerce-photo"
      role="img"
      aria-label={`${item.title}${original ? "参考示例" : "效果示例"}`}
      style={{
        backgroundPosition: `${(commerceCases.indexOf(item) * 100) / 3}% ${original ? 100 : 0}%`,
      }}
    />
  );
}
function RecentWorks() {
  const session = useImageSession();
  const query = useImageAssets();
  const outputs =
    query.data?.pages
      .flatMap((page) => page.data)
      .filter((item) => item.kind === "output")
      .slice(0, 4) ?? [];
  if (query.isError || session.isError)
    return (
      <p role="alert">
        作品暂时无法加载。
        <Button
          variant="ghost"
          size="sm"
          onPress={() => {
            void session.refetch();
            void query.refetch();
          }}
        >
          重新加载
        </Button>
      </p>
    );
  if (query.isPending)
    return (
      <p role="status">
        <Spinner size="sm" />
        正在加载作品…
      </p>
    );
  if (!outputs.length)
    return (
      <div className="home-recent-empty">
        <UiIcon icon={IconPhoto} size="illustration" />
        <p>还没有作品，先为你的商品创作一张图片吧。</p>
        <RouteLink to="/create">
          开始创作 <UiIcon icon={IconArrowRight} size="small" />
        </RouteLink>
      </div>
    );
  return (
    <div className="home-output-grid">
      {outputs.map((item) => (
        <RouteLink key={item.id} to="/assets" aria-label={`查看作品：${item.prompt ?? "生成图片"}`}>
          <img
            src={assetContentUrl(item.id, true)}
            alt={item.prompt ?? "生成图片"}
            loading="lazy"
          />
          <span>{item.prompt ?? "生成图片"}</span>
        </RouteLink>
      ))}
    </div>
  );
}

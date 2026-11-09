import { Button, Modal, Tabs } from "@heroui/react";
import {
  IconCamera,
  IconCopy,
  IconLayoutCollage,
  IconPhoto,
  IconSparkles,
  type TablerIcon,
} from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { type CSSProperties, useState } from "react";
import { useNavigate } from "react-router";
import { ConfirmDialog } from "../../components/overlays/confirm-dialog";
import { DialogClose } from "../../components/overlays/dialog-close";
import { UiIcon } from "../../components/ui-icon";
import { copyToClipboard } from "../../lib/clipboard";
import { useRequireLogin } from "../auth/login-prompt";
import { SelectionHighlight } from "../generation/composer/selection-highlight";
import { defaultDraft, useStudioStore } from "../generation/studio-state";
import {
  type HomeInspiration,
  homeInspirations,
  type InspirationCategory,
  inspirationCategories,
} from "./home-inspiration-data";
import { useInspirationColumns } from "./use-inspiration-columns";
import "./home-inspiration-gallery.css";

// 卡片左下角的分类标签图标，与工作区工具图标保持同一风格。
const categoryIcons = {
  商品主图: IconCamera,
  场景灵感: IconPhoto,
  家纺展示: IconLayoutCollage,
  创意视觉: IconSparkles,
} satisfies Record<HomeInspiration["category"], TablerIcon>;

/** 展示灵感示例，用户确认后带入主图草稿，不自动提交任务。 */
export function HomeInspirationGallery() {
  const navigate = useNavigate();
  const requireLogin = useRequireLogin();
  const [category, setCategory] = useState<InspirationCategory>("全部");
  const [selected, setSelected] = useState<HomeInspiration | null>(null);
  const [replacing, setReplacing] = useState<HomeInspiration | null>(null);
  const visible = homeInspirations.filter(
    (item) => category === "全部" || item.category === category,
  );
  const columns = useInspirationColumns(visible);
  function apply(item: HomeInspiration) {
    const { activeModel, updateDraft } = useStudioStore.getState();
    updateDraft(activeModel, { prompt: item.prompt });
    setReplacing(null);
    setSelected(null);
    void navigate("/commerce/create");
  }
  // 示例只填入提示词，进入工作台不上传示例或提交付费任务。
  function use(item: HomeInspiration) {
    if (!requireLogin()) return;
    const { activeModel, drafts } = useStudioStore.getState();
    const draft = drafts[activeModel] ?? defaultDraft;
    if (draft.prompt.trim() && draft.prompt !== item.prompt) setReplacing(item);
    else apply(item);
  }
  return (
    <section className="home-inspiration" aria-labelledby="home-inspiration-title">
      <h2 id="home-inspiration-title" className="sr-only">
        创作灵感
      </h2>
      <Tabs
        selectedKey={category}
        onSelectionChange={(key) => {
          const next = inspirationCategories.find((entry) => entry === key);
          if (next) setCategory(next);
        }}
      >
        <div className="home-inspiration-bar">
          <Tabs.ListContainer>
            <Tabs.List aria-label="灵感分类">
              {inspirationCategories.map((name) => (
                <Tabs.Tab id={name} key={name}>
                  {name === category && (
                    <SelectionHighlight
                      layoutId="home-inspiration-selection"
                      layoutDependency={category}
                    />
                  )}
                  {name}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
          <p className="home-inspiration-note">AI 示例素材 · 挑一个风格，一键做同款</p>
        </div>
        <Tabs.Panel id={category}>
          <div className="home-inspiration-grid">
            {columns.map((column, columnIndex) => (
              <div className="home-inspiration-column" key={column.id}>
                {column.items.map((item, position) => (
                  <InspirationTile
                    key={item.id}
                    item={item}
                    order={columnIndex + position}
                    onOpen={() => setSelected(item)}
                    onUse={() => use(item)}
                  />
                ))}
              </div>
            ))}
          </div>
        </Tabs.Panel>
      </Tabs>
      {selected && (
        <InspirationDetail
          item={selected}
          onClose={() => setSelected(null)}
          onUse={() => use(selected)}
        />
      )}
      <ConfirmDialog
        isOpen={replacing !== null}
        title="替换当前提示词？"
        content="当前已有创作内容。替换提示词后，已添加的参考图和参数会保留。"
        confirmLabel="替换并进入"
        cancelLabel="保留当前内容"
        onCancel={() => setReplacing(null)}
        onConfirm={() => {
          if (replacing) apply(replacing);
        }}
      />
    </section>
  );
}

/** 取图片最底一行的平均色；悬停时卡片下方的标题面板用它和图片衔接（与 vidmuse 一致）。 */
function bottomColorOf(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 8;
  const context = canvas.getContext("2d");
  if (!context) return null;
  try {
    context.drawImage(image, 0, 0, 8, 8);
    const pixels = context.getImageData(0, 7, 8, 1).data;
    let red = 0;
    let green = 0;
    let blue = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      red += pixels[index] ?? 0;
      green += pixels[index + 1] ?? 0;
      blue += pixels[index + 2] ?? 0;
    }
    // 保留色相但把最亮通道压到 96 以内：面板再叠 40% 黑后，白色标题与说明的对比度都不低于 4.5:1。
    const scale = Math.min(1, 96 / Math.max(red / 8, green / 8, blue / 8, 1));
    const channel = (sum: number) => Math.round((sum / 8) * scale);
    return `rgb(${channel(red)} ${channel(green)} ${channel(blue)})`;
  } catch {
    // 图片无法读取像素时沿用默认深色面板，不影响查看与做同款。
    return null;
  }
}

/** 点图片打开详情；“做同款”是并列按钮，不嵌套在图片按钮里。 */
function InspirationTile({
  item,
  order,
  onOpen,
  onUse,
}: {
  item: HomeInspiration;
  order: number;
  onOpen: () => void;
  onUse: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [bottomColor, setBottomColor] = useState<string | null>(null);
  const tileStyle: CSSProperties & { "--tile-bottom": string } = {
    "--tile-bottom": bottomColor ?? "#1c1c1f",
  };
  return (
    <motion.div
      className="home-inspiration-tile"
      initial={reduceMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{
        duration: 0.5,
        delay: Math.min(order, 6) * 0.05,
        ease: [0.215, 0.61, 0.355, 1],
      }}
    >
      <Button
        variant="tertiary"
        className="home-inspiration-card"
        data-shape={item.shape}
        style={tileStyle}
        aria-label={`查看灵感：${item.title}`}
        onPress={onOpen}
      >
        <span className="home-inspiration-media">
          <img
            src={item.image}
            alt={item.title}
            width="480"
            height="480"
            loading="lazy"
            decoding="async"
            onLoad={(event) => setBottomColor(bottomColorOf(event.currentTarget))}
          />
          <span className="home-inspiration-fade" aria-hidden="true" />
          <span className="home-inspiration-tag">
            <UiIcon icon={categoryIcons[item.category]} size="small" />
            {item.category}
          </span>
        </span>
        {/* 悬停面板接在图片下方，仍属于卡片按钮：点面板任意处都打开这张卡的详情，不会点到下面的卡。 */}
        <span className="home-inspiration-panel" aria-hidden="true">
          <strong>{item.title}</strong>
          <span className="home-inspiration-panel-prompt">{item.prompt}</span>
        </span>
      </Button>
      {/* “做同款”与卡片按钮并列（按钮不能嵌套），定位在面板第二行左侧。 */}
      <Button
        size="sm"
        variant="primary"
        className="home-inspiration-cta"
        aria-label={`做同款：${item.title}`}
        onPress={onUse}
      >
        做同款
      </Button>
    </motion.div>
  );
}

function InspirationDetail({
  item,
  onClose,
  onUse,
}: {
  item: HomeInspiration;
  onClose: () => void;
  onUse: () => void;
}) {
  const requireLogin = useRequireLogin();
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Backdrop>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog className="home-inspiration-detail" aria-label={`灵感详情：${item.title}`}>
            {/* The example's own colours glow through the glass, so each detail matches its image. */}
            <img className="home-inspiration-ambient" src={item.image} alt="" />
            <Modal.Header>
              <Modal.Heading>{item.title}</Modal.Heading>
              <DialogClose label="关闭灵感详情" />
            </Modal.Header>
            <Modal.Body>
              <div className="home-inspiration-detail-content">
                <img src={item.image} alt={item.title} width="480" height="480" />
                <div className="home-inspiration-description">
                  <span>{item.category} · 示例素材</span>
                  <h3>创作提示词</h3>
                  <p className="home-inspiration-prompt">{item.prompt}</p>
                  <p className="home-inspiration-hint">上传你的商品图，使用这段描述开始创作。</p>
                  <div className="home-inspiration-actions">
                    <Button
                      variant="secondary"
                      onPress={() => {
                        if (requireLogin()) void copyToClipboard(item.prompt);
                      }}
                    >
                      <UiIcon icon={IconCopy} size="small" />
                      复制提示词
                    </Button>
                    <Button variant="primary" onPress={onUse}>
                      做同款
                    </Button>
                  </div>
                </div>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

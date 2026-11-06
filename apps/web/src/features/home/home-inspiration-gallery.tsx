import { Button, Modal, Tabs } from "@heroui/react";
import { IconCopy } from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { DialogClose } from "../../components/dialog-close";
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
      <Tabs
        selectedKey={category}
        onSelectionChange={(key) => {
          const next = inspirationCategories.find((entry) => entry === key);
          if (next) setCategory(next);
        }}
      >
        <div className="home-inspiration-heading">
          <h2 id="home-inspiration-title">创作灵感</h2>
          <p>挑一个喜欢的风格，一键做同款</p>
        </div>
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

/** The picture opens the detail; 做同款 is a sibling button, never nested inside the picture. */
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
      <img
        className="home-inspiration-glow"
        src={item.image}
        alt=""
        loading="lazy"
        decoding="async"
      />
      <Button
        variant="tertiary"
        className="home-inspiration-card"
        data-shape={item.shape}
        aria-label={`查看灵感：${item.title}`}
        onPress={onOpen}
      >
        <img
          src={item.image}
          alt={item.title}
          width="480"
          height="480"
          loading="lazy"
          decoding="async"
        />
        <span className="home-inspiration-caption">
          <strong>{item.title}</strong>
        </span>
      </Button>
      <div className="home-inspiration-panel">
        <strong aria-hidden="true">{item.title}</strong>
        <p aria-hidden="true">{item.prompt}</p>
        <Button
          size="sm"
          variant="primary"
          className="home-inspiration-cta"
          aria-label={`做同款：${item.title}`}
          onPress={onUse}
        >
          做同款
        </Button>
      </div>
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

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
import { useState } from "react";
import { useNavigate } from "react-router";
import { ConfirmDialog } from "../../components/overlays/confirm-dialog";
import { DialogClose } from "../../components/overlays/dialog-close";
import { UiIcon } from "../../components/ui-icon";
import { useLocale } from "../../i18n/locale-store";
import { useMessages } from "../../i18n/messages";
import { copyToClipboard } from "../../lib/clipboard";
import { useRequireLogin } from "../auth/login-prompt";
import { SelectionHighlight } from "../generation/composer/selection-highlight";
import { defaultDraft, useStudioStore } from "../generation/studio-state";
import {
  type HomeInspiration,
  homeInspirationsFor,
  type InspirationCategory,
  inspirationCategories,
} from "./home-inspiration-data";
import { homeInspirationMessages } from "./home-inspiration-messages";
import { useInspirationColumns } from "./use-inspiration-columns";
import "./home-inspiration-gallery.css";

// 卡片左下角的分类标签图标，与工作区工具图标保持同一风格。
const categoryIcons = {
  product: IconCamera,
  scene: IconPhoto,
  textile: IconLayoutCollage,
  creative: IconSparkles,
} satisfies Record<HomeInspiration["category"], TablerIcon>;

/** 展示灵感示例，用户确认后带入主图草稿，不自动提交任务。 */
export function HomeInspirationGallery() {
  const navigate = useNavigate();
  const requireLogin = useRequireLogin();
  const t = useMessages(homeInspirationMessages);
  const inspirations = homeInspirationsFor(useLocale());
  const [category, setCategory] = useState<InspirationCategory>("all");
  // 记住示例 id 而不是文字，切换语言后弹窗里的标题和提示词跟着换。
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const selected = inspirations.find((item) => item.id === selectedId) ?? null;
  const replacing = inspirations.find((item) => item.id === replacingId) ?? null;
  const visible = inspirations.filter((item) => category === "all" || item.category === category);
  const columns = useInspirationColumns(visible);
  function apply(item: HomeInspiration) {
    const { activeModel, updateDraft } = useStudioStore.getState();
    updateDraft(activeModel, { prompt: item.prompt });
    setReplacingId(null);
    setSelectedId(null);
    void navigate("/commerce/create");
  }
  // 示例只填入提示词，进入工作台不上传示例或提交付费任务。
  function use(item: HomeInspiration) {
    if (!requireLogin()) return;
    const { activeModel, drafts } = useStudioStore.getState();
    const draft = drafts[activeModel] ?? defaultDraft;
    if (draft.prompt.trim() && draft.prompt !== item.prompt) setReplacingId(item.id);
    else apply(item);
  }
  return (
    <section className="home-inspiration" aria-labelledby="home-inspiration-title">
      <h2 id="home-inspiration-title" className="sr-only">
        {t.title}
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
            <Tabs.List aria-label={t.categoryList}>
              {inspirationCategories.map((id) => (
                <Tabs.Tab id={id} key={id}>
                  {id === category && (
                    <SelectionHighlight
                      layoutId="home-inspiration-selection"
                      layoutDependency={category}
                    />
                  )}
                  {t.categories[id]}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
          <p className="home-inspiration-note">{t.note}</p>
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
                    onOpen={() => setSelectedId(item.id)}
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
          onClose={() => setSelectedId(null)}
          onUse={() => use(selected)}
        />
      )}
      <ConfirmDialog
        isOpen={replacing !== null}
        title={t.replaceTitle}
        content={t.replaceContent}
        confirmLabel={t.replaceConfirm}
        cancelLabel={t.keepCurrent}
        onCancel={() => setReplacingId(null)}
        onConfirm={() => {
          if (replacing) apply(replacing);
        }}
      />
    </section>
  );
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
  const t = useMessages(homeInspirationMessages);
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
        aria-label={t.view(item.title)}
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
        <span className="home-inspiration-tag">
          <UiIcon icon={categoryIcons[item.category]} size="small" />
          {t.categories[item.category]}
        </span>
        {/* 悬停时卡内升起玻璃面板；面板属于卡片按钮，点它也打开详情。 */}
        <span className="home-inspiration-panel" aria-hidden="true">
          <strong>{item.title}</strong>
          <span className="home-inspiration-panel-prompt">{item.prompt}</span>
        </span>
      </Button>
      {/* “做同款”与卡片按钮并列（按钮不能嵌套），定位在玻璃面板左下角。 */}
      <Button
        size="sm"
        variant="primary"
        className="home-inspiration-cta"
        aria-label={t.useNamed(item.title)}
        onPress={onUse}
      >
        {t.use}
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
  const t = useMessages(homeInspirationMessages);
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Backdrop>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog className="home-inspiration-detail" aria-label={t.details(item.title)}>
            {/* 示例图本身的颜色透过玻璃发光，每个详情弹窗都和它的图片相配。 */}
            <img className="home-inspiration-ambient" src={item.image} alt="" />
            <Modal.Header>
              <Modal.Heading>{item.title}</Modal.Heading>
              <DialogClose label={t.closeDetails} />
            </Modal.Header>
            <Modal.Body>
              <div className="home-inspiration-detail-content">
                <img src={item.image} alt={item.title} width="480" height="480" />
                <div className="home-inspiration-description">
                  <span>{t.sample(t.categories[item.category])}</span>
                  <h3>{t.prompt}</h3>
                  <p className="home-inspiration-prompt">{item.prompt}</p>
                  <p className="home-inspiration-hint">{t.hint}</p>
                  <div className="home-inspiration-actions">
                    <Button
                      variant="secondary"
                      onPress={() => {
                        if (requireLogin()) void copyToClipboard(item.prompt);
                      }}
                    >
                      <UiIcon icon={IconCopy} size="small" />
                      {t.copyPrompt}
                    </Button>
                    <Button variant="primary" onPress={onUse}>
                      {t.use}
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

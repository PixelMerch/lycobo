import { Button, Modal } from "@heroui/react";
import { useId, useState } from "react";
import { CopyPromptButton } from "../../components/copy-prompt-button";
import { ConfirmDialog } from "../../components/overlays/confirm-dialog";
import { DialogClose } from "../../components/overlays/dialog-close";
import { useDialogDismiss } from "../../components/overlays/use-dialog-dismiss";
import { useLocale } from "../../i18n/locale-store";
import { useMessages } from "../../i18n/messages";
import { useAppNavigate } from "../../i18n/use-localized-navigation";
import { dashboardToolPaths } from "../../lib/dashboard-paths";
import { useRequireLogin } from "../auth/login-prompt";
import { defaultDraft, useStudioStore } from "../generation/studio-state";
import { type HomeInspiration, homeInspirationsFor } from "./home-inspiration-data";
import { homeInspirationMessages } from "./home-inspiration-messages";
import { InspirationWall } from "./home-inspiration-wall";
import "./home-inspiration-gallery.css";

/**
 * 展示灵感示例，用户确认后带入主图草稿，不自动提交任务。
 * 灵感库页面和素材库的灵感标签共用完整列表。
 * onApplied 在带着提示词去工作台后调用，素材库弹窗借此关闭自己。
 */
export function HomeInspirationGallery({
  onApplied,
  standalone = false,
}: {
  onApplied?: () => void;
  standalone?: boolean;
}) {
  const navigate = useAppNavigate();
  const requireLogin = useRequireLogin();
  const t = useMessages(homeInspirationMessages);
  const Heading = standalone ? "h1" : "h2";
  // 灵感库页面和素材库弹窗可能同时挂载，标题 id 各用各的。
  const titleId = useId();
  const inspirations = homeInspirationsFor(useLocale());
  // 记住示例 id 而不是文字，切换语言后弹窗里的标题和提示词跟着换。
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const selected = inspirations.find((item) => item.id === selectedId) ?? null;
  const replacing = inspirations.find((item) => item.id === replacingId) ?? null;
  function apply(item: HomeInspiration) {
    const { activeModel, updateDraft } = useStudioStore.getState();
    updateDraft(activeModel, { prompt: item.prompt });
    setReplacingId(null);
    setSelectedId(null);
    void navigate(dashboardToolPaths.create);
    onApplied?.();
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
    <section className="home-inspiration" aria-labelledby={titleId}>
      <Heading id={titleId} className="sr-only">
        {standalone ? t.libraryTitle : t.title}
      </Heading>
      <InspirationWall
        items={inspirations}
        standalone={standalone}
        onOpen={(item) => setSelectedId(item.id)}
        onUse={use}
      />
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

/** 用共用弹框展示灵感图和创作提示词。 */
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
  const dismiss = useDialogDismiss(onClose);
  return (
    <Modal
      isOpen={dismiss.isOpen}
      onOpenChange={(open) => {
        if (!open) dismiss.requestClose();
      }}
    >
      <Modal.Backdrop onAnimationEnd={dismiss.onAnimationEnd}>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog className="home-inspiration-detail" aria-label={t.details(item.title)}>
            <Modal.Header>
              <Modal.Heading>{item.title}</Modal.Heading>
              <DialogClose label={t.closeDetails} />
            </Modal.Header>
            <Modal.Body>
              <div className="home-inspiration-detail-content">
                <img src={item.image} alt={item.title} width="480" height="480" />
                <div className="home-inspiration-description">
                  <span>{t.categories[item.category]}</span>
                  <h3>{t.prompt}</h3>
                  <p className="home-inspiration-prompt">{item.prompt}</p>
                  <p className="home-inspiration-hint">{t.hint}</p>
                  <div className="home-inspiration-actions">
                    <CopyPromptButton text={item.prompt} canCopy={requireLogin} />
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

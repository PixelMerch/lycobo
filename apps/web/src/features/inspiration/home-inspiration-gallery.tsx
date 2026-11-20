import { Button, Modal } from "@heroui/react";
import { useId, useState } from "react";
import { CopyPromptButton } from "../../components/copy-prompt-button";
import { DialogClose } from "../../components/overlays/dialog-close";
import { useLocale } from "../../i18n/locale-store";
import { useMessages } from "../../i18n/messages";
import { useAppNavigate } from "../../i18n/use-localized-navigation";
import { dashboardToolPaths } from "../../lib/dashboard-paths";
import { useRequireLogin } from "../auth/login-prompt";
import { useStudioStore } from "../generation/studio-state";
import { type HomeInspiration, homeInspirationsFor } from "./home-inspiration-data";
import { homeInspirationMessages } from "./home-inspiration-messages";
import { InspirationWall } from "./home-inspiration-wall";
import "./home-inspiration-gallery.css";

/**
 * 展示灵感示例，“做同款”只替换主图草稿的提示词。
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
  const selected = inspirations.find((item) => item.id === selectedId) ?? null;
  function applyInspiration(item: HomeInspiration) {
    if (!requireLogin()) return;
    // 只更新提示词，保留参考图和生成参数。
    const { activeModel, updateDraft } = useStudioStore.getState();
    updateDraft(activeModel, { prompt: item.prompt });
    setSelectedId(null);
    void navigate(dashboardToolPaths.create);
    onApplied?.();
  }
  return (
    <section className="home-inspiration" aria-labelledby={titleId}>
      <Heading id={titleId} className="sr-only">
        {standalone ? t.libraryTitle : t.title}
      </Heading>
      <InspirationWall
        items={inspirations}
        onOpen={(item) => setSelectedId(item.id)}
        onUse={applyInspiration}
      />
      {selected && (
        <InspirationDetail
          item={selected}
          onClose={() => setSelectedId(null)}
          onUse={() => applyInspiration(selected)}
        />
      )}
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
            <Modal.Header>
              <Modal.Heading>{item.title}</Modal.Heading>
              <DialogClose label={t.closeDetails} />
            </Modal.Header>
            <Modal.Body>
              <div className="home-inspiration-detail-content">
                <img src={item.image} alt={item.title} width="480" height="480" />
                <div className="home-inspiration-description">
                  <div className="home-inspiration-prompt-group">
                    <span>{t.categories[item.category]}</span>
                    <h3>{t.prompt}</h3>
                    <p className="home-inspiration-prompt">{item.prompt}</p>
                  </div>
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

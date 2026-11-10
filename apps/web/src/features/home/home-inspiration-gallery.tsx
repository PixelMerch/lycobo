import { Button, Modal } from "@heroui/react";
import { IconCopy } from "@tabler/icons-react";
import { useState } from "react";
import { ConfirmDialog } from "../../components/overlays/confirm-dialog";
import { DialogClose } from "../../components/overlays/dialog-close";
import { UiIcon } from "../../components/ui-icon";
import { useLocale } from "../../i18n/locale-store";
import { useMessages } from "../../i18n/messages";
import { useAppNavigate } from "../../i18n/use-localized-navigation";
import { copyToClipboard } from "../../lib/clipboard";
import { useRequireLogin } from "../auth/login-prompt";
import { defaultDraft, useStudioStore } from "../generation/studio-state";
import { type HomeInspiration, homeInspirationsFor } from "./home-inspiration-data";
import { homeInspirationMessages } from "./home-inspiration-messages";
import { InspirationWall } from "./home-inspiration-wall";
import "./home-inspiration-gallery.css";

/**
 * 展示灵感示例，用户确认后带入主图草稿，不自动提交任务。
 * 首页作品墙分批加载后给出“查看更多案例”；案例库页面传 library，一次显示全部。
 */
export function HomeInspirationGallery({ library = false }: { library?: boolean }) {
  const navigate = useAppNavigate();
  const requireLogin = useRequireLogin();
  const t = useMessages(homeInspirationMessages);
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
      <InspirationWall
        items={inspirations}
        library={library}
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

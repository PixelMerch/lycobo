import { Button, Modal, Tabs } from "@heroui/react";
import { IconArrowUpRight, IconCopy } from "@tabler/icons-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { DialogClose } from "../../components/dialog-close";
import { UiIcon } from "../../components/ui-icon";
import { copyToClipboard } from "../../lib/clipboard";
import { defaultDraft, useStudioStore } from "../generation/studio-state";
import {
  type HomeInspiration,
  homeInspirations,
  type InspirationCategory,
  inspirationCategories,
} from "./home-inspiration-data";
import "./home-inspiration-gallery.css";

export function HomeInspirationGallery() {
  const [category, setCategory] = useState<InspirationCategory>("全部");
  const [selected, setSelected] = useState<HomeInspiration | null>(null);
  const visible = homeInspirations.filter(
    (item) => category === "全部" || item.category === category,
  );
  return (
    <section className="home-inspiration" aria-labelledby="home-inspiration-title">
      <div className="home-inspiration-heading">
        <h2 id="home-inspiration-title">电商创作灵感</h2>
        <p>示例素材 · 找到下一张商品图的方向</p>
      </div>
      <Tabs
        selectedKey={category}
        onSelectionChange={(key) => {
          const next = inspirationCategories.find((entry) => entry === key);
          if (next) setCategory(next);
        }}
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="灵感分类">
            {inspirationCategories.map((name) => (
              <Tabs.Tab id={name} key={name}>
                {name}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id={category}>
          <div className="home-inspiration-grid">
            {visible.map((item) => (
              <Button
                variant="tertiary"
                className="home-inspiration-card"
                data-shape={item.shape}
                key={item.id}
                aria-label={`查看灵感：${item.title}`}
                onPress={() => setSelected(item)}
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
                  <span>
                    <small>{item.category}</small>
                    <strong>{item.title}</strong>
                  </span>
                  <UiIcon icon={IconArrowUpRight} />
                </span>
              </Button>
            ))}
          </div>
        </Tabs.Panel>
      </Tabs>
      {selected && <InspirationDetail item={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

function InspirationDetail({ item, onClose }: { item: HomeInspiration; onClose: () => void }) {
  const navigate = useNavigate();
  const [replaceOpen, setReplaceOpen] = useState(false);
  function apply() {
    const { activeModel, updateDraft } = useStudioStore.getState();
    updateDraft(activeModel, { prompt: item.prompt });
    onClose();
    navigate("/create");
  }
  return (
    <>
      <Modal
        isOpen
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <Modal.Backdrop>
          <Modal.Container size="lg" scroll="inside">
            <Modal.Dialog
              className="home-inspiration-detail"
              aria-label={`灵感详情：${item.title}`}
            >
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
                    <p>{item.prompt}</p>
                    <p className="home-inspiration-hint">上传你的商品图，使用这段描述开始创作。</p>
                    <div className="home-inspiration-actions">
                      <Button variant="secondary" onPress={() => void copyToClipboard(item.prompt)}>
                        <UiIcon icon={IconCopy} size="small" />
                        复制提示词
                      </Button>
                      <Button
                        variant="primary"
                        onPress={() => {
                          const { activeModel, drafts } = useStudioStore.getState();
                          const draft = drafts[activeModel] ?? defaultDraft;
                          if (draft.prompt.trim() && draft.prompt !== item.prompt)
                            setReplaceOpen(true);
                          else apply();
                        }}
                      >
                        使用提示词
                        <UiIcon icon={IconArrowUpRight} size="small" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      <ConfirmDialog
        isOpen={replaceOpen}
        title="替换当前提示词？"
        content="当前已有创作内容。替换提示词后，已添加的参考图和参数会保留。"
        confirmLabel="替换并进入"
        cancelLabel="保留当前内容"
        onCancel={() => setReplaceOpen(false)}
        onConfirm={apply}
      />
    </>
  );
}

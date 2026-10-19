import { Button, Modal, Tabs } from "@heroui/react";
import { IconBanana, IconPhoto } from "@tabler/icons-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { UiIcon } from "../../components/ui-icon";
import {
  cases,
  type ModelId,
  models,
  photo,
  type StudioCase,
  useStudioStore,
} from "./studio-state";

export function CaseGallery({ compact = false }: { compact?: boolean }) {
  const [category, setCategory] = useState("全部");
  const [selected, setSelected] = useState<StudioCase | null>(null);
  return (
    <section className={`case-gallery ${compact ? "compact" : ""}`} aria-label="创作案例">
      <div className="section-heading">
        <h2>创作案例</h2>
        {compact ? <p>查看案例，获取创作灵感</p> : null}
      </div>
      {!compact ? (
        <Tabs selectedKey={category} onSelectionChange={(key) => setCategory(String(key))}>
          <Tabs.List aria-label="案例分类">
            {["全部", "场景", "配色", "图文"].map((name) => (
              <Tabs.Tab id={name} key={name}>
                {name}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
          <Tabs.Panel id={category}>
            <CaseCards
              items={cases.filter((item) => category === "全部" || item.category === category)}
              onSelect={setSelected}
            />
          </Tabs.Panel>
        </Tabs>
      ) : (
        <CaseCards items={cases} onSelect={setSelected} />
      )}
      <CaseDetail item={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
function CaseCards({
  items,
  onSelect,
}: {
  items: readonly StudioCase[];
  onSelect: (item: StudioCase) => void;
}) {
  return (
    <div className="case-grid">
      {items.map((item) => (
        <article className="case-card" key={item.id}>
          <img
            src={photo(item.image, true)}
            alt={item.title}
            width="480"
            height="480"
            loading="lazy"
          />
          <div>
            <h3>{item.title}</h3>
            <Button
              variant="tertiary"
              className="small-button"
              aria-label={`查看案例：${item.title}`}
              onPress={() => onSelect(item)}
            >
              查看案例
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
function CaseDetail({ item, onClose }: { item: StudioCase | null; onClose: () => void }) {
  const [replaceModel, setReplaceModel] = useState<ModelId | null>(null);
  const updateDraft = useStudioStore((s) => s.updateDraft);
  const navigate = useNavigate();
  function apply(model: ModelId) {
    if (!item) return;
    updateDraft(model, {
      prompt: item.prompt,
      references: [{ id: `case-${item.id}`, name: item.title, src: photo(item.image) }],
    });
    useStudioStore.getState().setChooserOpen(false);
    setReplaceModel(null);
    onClose();
    navigate(`/create/${model}`);
  }
  return (
    <Modal
      isOpen={item !== null}
      onOpenChange={(open) => {
        if (!open) {
          setReplaceModel(null);
          onClose();
        }
      }}
    >
      <Modal.Backdrop>
        <Modal.Container scroll="inside">
          <Modal.Dialog className="case-dialog">
            <Modal.Header>
              <Modal.Heading>{item?.title}</Modal.Heading>
              <Modal.CloseTrigger aria-label="关闭案例" />
            </Modal.Header>
            <Modal.Body>
              {item ? (
                <>
                  <img src={photo(item.image)} alt={item.title} width="960" height="960" />
                  <p>{item.prompt}</p>
                  {replaceModel ? (
                    <div className="replace-confirm" role="alert">
                      <p>此模型已有草稿，是否替换参考图与画面要求？</p>
                      <Button variant="secondary" onPress={() => setReplaceModel(null)}>
                        保留草稿
                      </Button>
                      <Button className="primary-action" onPress={() => apply(replaceModel)}>
                        替换并进入
                      </Button>
                    </div>
                  ) : (
                    <div className="case-model-actions">
                      {models.map((model) => (
                        <Button
                          key={model.id}
                          variant="secondary"
                          onPress={() => {
                            const draft = useStudioStore.getState().drafts[model.id];
                            if (draft.prompt || draft.references.length) setReplaceModel(model.id);
                            else apply(model.id);
                          }}
                        >
                          <UiIcon icon={model.id === "banana" ? IconBanana : IconPhoto} />
                          使用 {model.name} 创作
                        </Button>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

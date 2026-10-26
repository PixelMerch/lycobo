import { Button, Popover, Tabs } from "@heroui/react";
import { imageUnitCredits } from "@lycoboai/contracts";
import { IconPlus, IconX } from "@tabler/icons-react";
import { useId, useRef, useState } from "react";
import { CreditCoin } from "../../../components/credit-coin";
import { UiIcon } from "../../../components/ui-icon";
import { HomeRatioPicker } from "../../generation/composer/ratio-picker";
import { GenerationHistory } from "../../generation/history/generation-history";
import { HistoryIndex } from "../../generation/history/history-index";
import { TextileImageField } from "./textile-image-field";
import { useTextileSetDraft } from "./textile-set-state";
import { textileViewImages, textileViews } from "./textile-views";
import { TextileViewsDialog } from "./textile-views-dialog";
import { useTextileGeneration } from "./use-textile-generation";
import "./textile-set.css";

export function TextileSetPage() {
  const { mainImage, detailImage, views, ratio, update } = useTextileSetDraft();
  const viewsAnchor = useRef<HTMLDivElement>(null);
  const viewsTrigger = useRef<HTMLButtonElement>(null);
  const viewsPressWasOpen = useRef<boolean | null>(null);
  const [viewsOpen, setViewsOpen] = useState(false);
  const generation = useTextileGeneration();
  const costDescriptionId = useId();
  const selectedViews = textileViews.filter((view) => views.includes(view.id));
  return (
    <div className="workspace textile-workspace">
      <div ref={viewsAnchor} className="textile-views-anchor" aria-hidden="true" />
      <section className="composer-panel" aria-label="家纺主图裂变参数">
        <div className="composer-scroll">
          <h1 className="textile-title">家纺主图裂变</h1>
          <TextileImageField
            label="主图"
            required
            description="上传清晰的家纺主图，完整展示床品"
            exampleSrc="/studio/bedroom-thumb.webp"
            value={mainImage}
            onChange={(image) => update({ mainImage: image })}
            number={1}
          />
          <TextileImageField
            label="详情图"
            description="补充面料、花型或床品局部细节"
            exampleSrc="/studio/set-thumb.webp"
            exampleIsDetail
            value={detailImage}
            onChange={(image) => update({ detailImage: image })}
            number={2}
          />
          <section className="parameter-group textile-view-field" aria-label="裂变类型">
            <h2>
              <span aria-hidden="true" className="textile-required">
                *
              </span>
              裂变类型
            </h2>
            <div className={selectedViews.length ? "textile-selected-grid" : undefined}>
              {selectedViews.map((view) => (
                <div className="textile-selected-view" key={view.id}>
                  <span className="textile-selected-example" aria-hidden="true">
                    {textileViewImages[view.id] && (
                      <img
                        src={textileViewImages[view.id]}
                        alt=""
                        width={480}
                        height={480}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                      />
                    )}
                  </span>
                  <span className="textile-selected-name">{view.name}</span>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="tertiary"
                    className="textile-selected-remove"
                    aria-label={`移除裂变类型：${view.name}`}
                    onPress={() => {
                      update({ views: views.filter((id) => id !== view.id) });
                      viewsTrigger.current?.focus();
                    }}
                  >
                    <UiIcon icon={IconX} size="small" />
                  </Button>
                </div>
              ))}
              <Popover isOpen={viewsOpen} onOpenChange={setViewsOpen}>
                <Button
                  ref={viewsTrigger}
                  onPointerDown={() => {
                    // Blur may close the non-modal popover before this press completes.
                    viewsPressWasOpen.current = viewsOpen;
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ")
                      viewsPressWasOpen.current = viewsOpen;
                  }}
                  onPress={() => {
                    setViewsOpen(!(viewsPressWasOpen.current ?? viewsOpen));
                    viewsPressWasOpen.current = null;
                  }}
                  variant="tertiary"
                  className="textile-view-trigger"
                  aria-label="选择裂变类型"
                >
                  <UiIcon icon={IconPlus} size="action" />
                  {!selectedViews.length && <span>选择裂变类型</span>}
                </Button>
                {viewsOpen && (
                  <TextileViewsDialog
                    anchorRef={viewsAnchor}
                    triggerRef={viewsTrigger}
                    selected={views}
                    onConfirm={(value) => update({ views: value })}
                    onClose={() => setViewsOpen(false)}
                  />
                )}
              </Popover>
            </div>
          </section>
          <section className="parameter-group" aria-label="图片比例">
            <div className="ratio-heading">
              <h2>图片比例</h2>
              <span className="muted">{ratio}</span>
            </div>
            <HomeRatioPicker value={ratio} onChange={(value) => update({ ratio: value })} />
          </section>
        </div>
        <div className="generate-area">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            className="primary-action generation-submit"
            isDisabled={!generation.canGenerate}
            isPending={generation.submitting}
            onPress={generation.submit}
            aria-describedby={costDescriptionId}
          >
            {generation.submitting ? "正在提交…" : generation.pending ? "确认上次提交" : "立即生成"}
            {!generation.pending && (
              <span className="generate-credit-cost" aria-hidden="true">
                <CreditCoin />
                <span>{views.length * imageUnitCredits}</span>
              </span>
            )}
          </Button>
          <span id={costDescriptionId} className="sr-only">
            {generation.pending
              ? "确认上次提交，不会重复扣费"
              : `本次生成 ${views.length} 张，消耗 ${views.length * imageUnitCredits} 积分`}
          </span>
          {generation.unavailable && (
            <p className="textile-service-status">当前服务尚未启用参考图生成</p>
          )}
        </div>
      </section>
      <section className="results-panel" aria-label="家纺主图裂变内容">
        <Tabs className="workspace-tabs">
          <Tabs.ListContainer>
            <Tabs.List aria-label="家纺主图裂变工作区">
              <Tabs.Tab id="history">历史记录</Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel id="history">
            <GenerationHistory
              tool="textile"
              onRestore={({ draft, textileSet }) => {
                if (!textileSet) return;
                update({
                  mainImage: draft.references[0] ?? null,
                  detailImage: draft.references[1] ?? null,
                  views: textileSet.views,
                  ratio: draft.ratio,
                });
              }}
            />
          </Tabs.Panel>
        </Tabs>
      </section>
      <HistoryIndex tool="textile" />
    </div>
  );
}

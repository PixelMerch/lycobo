import { Button, Popover, Tabs, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { imageResolutionSchema, imageUnitCredits } from "@lycoboai/contracts";
import { IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { useId, useRef, useState } from "react";
import { CreditCoin } from "../../../components/credit-coin";
import { UiIcon } from "../../../components/ui-icon";
import { HomeRatioPicker } from "../../generation/composer/ratio-picker";
import { SelectionHighlight } from "../../generation/composer/selection-highlight";
import { GenerationHistory } from "../../generation/history/generation-history";
import { HistoryIndex } from "../../generation/history/history-index";
import { TextileImageField } from "./textile-image-field";
import { useTextileSetDraft } from "./textile-set-state";
import { textileViewImages, textileViews } from "./textile-views";
import { TextileViewsDialog } from "./textile-views-dialog";
import { useTextileGeneration } from "./use-textile-generation";
import "./textile-set.css";

export function TextileSetPage() {
  const { mainImage, detailImages, views, ratio, resolution, update } = useTextileSetDraft();
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
            value={mainImage ? [mainImage] : []}
            onChange={(images) => update({ mainImage: images[0] ?? null })}
            number={1}
          />
          <TextileImageField
            label="详情图"
            description="补充面料、花型或床品局部细节"
            exampleSrc="/studio/textile-views/fabric.webp"
            value={detailImages}
            maxImages={5}
            onChange={(images) => update({ detailImages: images })}
            number={2}
          />
          <section className="parameter-group textile-view-field" aria-label="裂变类型">
            <div className="field-title">
              <h2>
                <span aria-hidden="true" className="textile-required">
                  *
                </span>
                裂变类型
              </h2>
              {selectedViews.length > 0 && (
                <Button
                  variant="tertiary"
                  size="sm"
                  className="clear-references"
                  aria-label="清除裂变类型"
                  onPress={() => {
                    update({ views: [] });
                    setViewsOpen(false);
                    viewsTrigger.current?.focus();
                  }}
                >
                  <UiIcon icon={IconTrash} size="small" />
                  清除
                </Button>
              )}
            </div>
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
          <fieldset className="parameter-group">
            <legend>分辨率</legend>
            <ToggleButtonGroup
              aria-label="分辨率"
              className="parameter-options"
              isDetached
              disallowEmptySelection
              selectionMode="single"
              selectedKeys={[resolution]}
              onSelectionChange={(keys) => {
                const next = imageResolutionSchema.options.find((value) => keys.has(value));
                if (next) update({ resolution: next });
              }}
            >
              {imageResolutionSchema.options.map((value) => (
                <ToggleButton
                  key={value}
                  id={value}
                  isDisabled={!generation.resolutions.includes(value)}
                >
                  {value === resolution && (
                    <SelectionHighlight layoutId="textile-resolution-selection" />
                  )}
                  <span>{value}</span>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </fieldset>
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
            {generation.pending && !generation.submitting ? "确认上次提交" : "立即生成"}
            {(!generation.pending || generation.submitting) && (
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
                  detailImages: draft.references.slice(1, 6),
                  views: textileSet.views,
                  ratio: draft.ratio,
                  resolution: imageResolutionSchema.parse(draft.resolution),
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

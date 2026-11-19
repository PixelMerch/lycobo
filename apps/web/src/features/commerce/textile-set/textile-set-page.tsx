import { Button, Popover, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { imageUnitCredits, publicImageResolutions } from "@lycoboai/contracts";
import { IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { type RefObject, useId, useRef, useState } from "react";
import { SelectionPill } from "../../../components/selection-pill";
import { UiIcon } from "../../../components/ui-icon";
import { GenerateButton } from "../../generation/composer/generate-button";
import { HomeRatioPicker } from "../../generation/composer/ratio-picker";
import { WorkspaceComposerTitle } from "../../workspace/workspace-tool-symbol";

import { TextileImageField } from "./textile-image-field";
import { useTextileSetDraft } from "./textile-set-state";
import { textileViewImages, textileViews } from "./textile-views";
import { TextileViewsDialog } from "./textile-views-dialog";
import { useTextileGeneration } from "./use-textile-generation";
import "./textile-set.css";
import { useMessages } from "../../../i18n/messages";
import { textileMessages } from "./textile-messages";
import { textileViewMessages } from "./textile-view-messages";

/** 家纺裂变的参数面板：主图、详情图、裂变类型、比例与分辨率。 */
export function TextileSetPage() {
  const { mainImage, detailImages, views, ratio, resolution, update } = useTextileSetDraft();
  const t = useMessages(textileMessages);
  const viewsAnchor = useRef<HTMLDivElement>(null);
  const generation = useTextileGeneration();
  const cost = views.length * imageUnitCredits;
  const showCost = generation.canGenerate && !generation.pending && cost > 0;
  const costDescriptionId = useId();
  const costDescription = showCost ? t.runCost(views.length, cost) : undefined;
  const buttonDescription = generation.pending ? t.confirmNoCharge : costDescription;
  return (
    <>
      <div ref={viewsAnchor} className="textile-views-anchor" aria-hidden="true" />
      <section className="composer-panel" aria-label={t.parameters}>
        <div className="composer-scroll">
          <WorkspaceComposerTitle />
          <TextileImageField
            label={t.mainImage}
            required
            description={t.mainImageHint}
            exampleSrc="/studio/bedroom-thumb.webp"
            value={mainImage ? [mainImage] : []}
            onChange={(images) => update({ mainImage: images[0] ?? null })}
            number={1}
          />
          <TextileImageField
            label={t.detailImages}
            description={t.detailImagesHint}
            exampleSrc="/studio/textile-views/fabric.webp"
            value={detailImages}
            maxImages={5}
            onChange={(images) => update({ detailImages: images })}
            number={2}
          />
          <TextileViewField views={views} update={update} viewsAnchor={viewsAnchor} />
          <section className="parameter-group" aria-label={t.aspectRatio}>
            <div className="ratio-heading">
              <h2>{t.aspectRatio}</h2>
              <span className="muted">{ratio}</span>
            </div>
            <HomeRatioPicker
              stretchSelection
              value={ratio}
              onChange={(value) => update({ ratio: value })}
            />
          </section>
          <fieldset className="parameter-group">
            <legend>{t.resolution}</legend>
            <ToggleButtonGroup
              aria-label={t.resolution}
              className="parameter-options"
              isDetached
              disallowEmptySelection
              selectionMode="single"
              selectedKeys={[resolution]}
              onSelectionChange={(keys) => {
                const next = publicImageResolutions.find((value) => keys.has(value));
                if (next) update({ resolution: next });
              }}
            >
              {publicImageResolutions.map((value) => (
                <ToggleButton
                  key={value}
                  id={value}
                  isDisabled={!generation.resolutions.includes(value)}
                >
                  <span>{value}</span>
                </ToggleButton>
              ))}
              {generation.resolutions.includes(resolution) && <SelectionPill value={resolution} />}
            </ToggleButtonGroup>
          </fieldset>
        </div>
        <div className="generate-area">
          <GenerateButton
            label={
              generation.pending && !generation.submitting ? t.confirmLastSubmission : t.generateNow
            }
            submitting={generation.submitting}
            isDisabled={!generation.canGenerate}
            submittingLabel={t.submitting}
            cost={showCost ? cost : undefined}
            describedBy={costDescriptionId}
            onPress={generation.submit}
          />
          <span id={costDescriptionId} className="sr-only">
            {buttonDescription}
          </span>
          {generation.unavailable && <p className="textile-service-status">{t.serviceDisabled}</p>}
        </div>
      </section>
    </>
  );
}

function TextileViewField({
  views,
  update,
  viewsAnchor,
}: {
  views: ReturnType<typeof useTextileSetDraft.getState>["views"];
  update: ReturnType<typeof useTextileSetDraft.getState>["update"];
  viewsAnchor: RefObject<HTMLDivElement | null>;
}) {
  const viewsTrigger = useRef<HTMLButtonElement>(null);
  const viewsPressWasOpen = useRef<boolean | null>(null);
  const [viewsOpen, setViewsOpen] = useState(false);
  const t = useMessages(textileMessages);
  const viewNames = useMessages(textileViewMessages);
  const selectedViews = textileViews.filter((view) => views.includes(view.id));
  return (
    <section className="parameter-group textile-view-field" aria-label={t.viewTypes}>
      <div className="field-title">
        <h2>
          <span aria-hidden="true" className="textile-required">
            *
          </span>
          {t.viewTypes}
        </h2>
        {selectedViews.length > 0 && (
          <Button
            variant="tertiary"
            size="sm"
            className="clear-references"
            aria-label={t.clearViews}
            onPress={() => {
              update({ views: [] });
              setViewsOpen(false);
              viewsTrigger.current?.focus();
            }}
          >
            <UiIcon icon={IconTrash} size="small" />
            {t.clear}
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
            <span className="textile-selected-name">{viewNames[view.id]}</span>
            <Button
              isIconOnly
              size="sm"
              variant="tertiary"
              className="textile-selected-remove"
              aria-label={t.removeView(viewNames[view.id])}
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
              // 失焦可能在这次按下完成前就关闭非模态弹层，先记住按下时的开合状态。
              viewsPressWasOpen.current = viewsOpen;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") viewsPressWasOpen.current = viewsOpen;
            }}
            onPress={() => {
              setViewsOpen(!(viewsPressWasOpen.current ?? viewsOpen));
              viewsPressWasOpen.current = null;
            }}
            variant="tertiary"
            className="textile-view-trigger"
            aria-label={t.chooseViews}
          >
            <UiIcon icon={IconPlus} size="action" />
            {!selectedViews.length && <span>{t.chooseViews}</span>}
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
  );
}

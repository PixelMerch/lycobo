import { Button, Checkbox, Input, Label, Spinner, TextArea, TextField } from "@heroui/react";
import { IconCheck, IconTrash, IconX } from "@tabler/icons-react";
import { useLayoutEffect, useRef } from "react";
import { CreditCoin } from "../../../components/credit-coin";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { PlanReferenceStrip } from "./plan-reference-strip";
import { previewPlanItems } from "./plan-stream";
import { useSmartVariationDraft } from "./smart-variation-state";
import { useVariationGeneration } from "./use-variation-generation";
import { variationMessages } from "./variation-messages";

function PlanPrompt({
  value,
  index,
  onChange,
}: {
  value: string;
  index: number;
  onChange: (value: string) => void;
}) {
  const t = useMessages(variationMessages);
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let width = -1;
    const fit = () => {
      element.style.height = value.length === 0 ? "" : "auto";
      const border = element.offsetHeight - element.clientHeight;
      element.style.height = `${element.scrollHeight + border}px`;
    };
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      if (Math.abs(next - width) < 1) return;
      width = next;
      fit();
    });
    fit();
    observer.observe(element);
    return () => observer.disconnect();
  }, [value]);
  return (
    <TextField value={value} onChange={onChange}>
      <Label className="sr-only">{t.planPrompt(index + 1)}</Label>
      <TextArea ref={ref} rows={3} maxLength={4000} />
    </TextField>
  );
}

/** 套图计划确认面板：生成中显示流式预览，完成后可编辑、勾选和删除方案，再批量生成。 */
export function VariationPlanPanel({
  isOpen,
  onOpenChange,
  analyzing = false,
  streamText = "",
  readingWeb = false,
  analysisError,
}: {
  isOpen: boolean;
  analyzing?: boolean;
  streamText?: string;
  readingWeb?: boolean;
  analysisError?: string | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const { items, references, ratio, resolution, update } = useSmartVariationDraft();
  const generation = useVariationGeneration();
  const previews = previewPlanItems(streamText);
  const showPreview = analyzing || !!analysisError;
  const selectedCount = items.filter((item) => item.selected).length;
  const t = useMessages(variationMessages);
  const patchItem = (id: string, patch: Partial<(typeof items)[number]>) =>
    update({ items: items.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  if (!isOpen) return null;
  const planningStatus = previews.length ? t.refining : t.planning;
  const analysisStatus = readingWeb ? t.readingWeb : planningStatus;
  return (
    <section
      className="variation-plan-panel"
      aria-labelledby="variation-plan-heading"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onOpenChange(false);
        }
      }}
    >
      <header className="variation-plan-header">
        <div>
          <h2 id="variation-plan-heading">{analyzing ? t.generatingSet : t.confirmPrompts}</h2>
        </div>
        <Button
          isIconOnly
          variant="tertiary"
          className="dialog-close"
          aria-label={t.closePlan}
          onPress={() => onOpenChange(false)}
        >
          <UiIcon icon={IconX} size="action" />
        </Button>
      </header>
      <div className="variation-plan-body">
        <div className="variation-plan-list">
          {showPreview && (
            <>
              <p className="variation-plan-stream-status" role="status">
                {analysisError || analysisStatus}
              </p>
              {previews.map((item, index) => (
                <section
                  className="variation-plan-card"
                  key={item.id}
                  aria-label={t.draftPlan(index + 1)}
                >
                  <div className="variation-plan-card-heading">
                    <span className="variation-plan-number">{index + 1}</span>
                    <h3>{item.title || t.writingTitle}</h3>
                  </div>
                  <p className="variation-plan-stream-prompt">{item.prompt || t.writingPrompt}</p>
                </section>
              ))}
            </>
          )}
          {!showPreview &&
            items.map((item, index) => (
              <section
                className="variation-plan-card"
                data-selected={item.selected}
                key={item.id}
                aria-label={t.plan(index + 1)}
              >
                <div className="variation-plan-card-heading">
                  <span className="variation-plan-number">{index + 1}</span>
                  <TextField
                    value={item.title}
                    onChange={(title) => patchItem(item.id, { title })}
                    className="variation-plan-title"
                  >
                    <Label className="sr-only">{t.planName(index + 1)}</Label>
                    <Input maxLength={40} />
                  </TextField>
                  <Checkbox
                    isSelected={item.selected}
                    onChange={(selected) => patchItem(item.id, { selected })}
                  >
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator>
                          <UiIcon icon={IconCheck} size="small" />
                        </Checkbox.Indicator>
                      </Checkbox.Control>
                      <span className="sr-only">{t.selectPlan(index + 1)}</span>
                    </Checkbox.Content>
                  </Checkbox>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="tertiary"
                    aria-label={t.deletePlan(index + 1)}
                    onPress={() => update({ items: items.filter((entry) => entry.id !== item.id) })}
                  >
                    <UiIcon icon={IconTrash} />
                  </Button>
                </div>
                <PlanReferenceStrip
                  itemId={item.id}
                  planNumber={index + 1}
                  prompt={item.prompt}
                  references={references}
                />
                <PlanPrompt
                  value={item.prompt}
                  index={index}
                  onChange={(prompt) => patchItem(item.id, { prompt })}
                />
              </section>
            ))}
          {!showPreview && !items.length && <p className="variation-plan-empty">{t.noPlans}</p>}
        </div>
      </div>
      <footer className="variation-plan-footer">
        <div className="variation-plan-output">
          <span>
            {ratio} · {resolution} ·{" "}
            {showPreview ? t.confirmAfterPlan : t.selectedCount(selectedCount)}
          </span>
        </div>
        <VariationGenerateButton
          generation={generation}
          showPreview={showPreview}
          onComplete={() => onOpenChange(false)}
        />
      </footer>
    </section>
  );
}

function VariationGenerateButton({
  generation,
  showPreview,
  onComplete,
}: {
  generation: ReturnType<typeof useVariationGeneration>;
  showPreview: boolean;
  onComplete: () => void;
}) {
  const t = useMessages(variationMessages);
  const isDisabled = showPreview || !generation.canGenerate;
  const showCost = !isDisabled && !generation.pending && generation.cost > 0;
  return (
    <Button
      isDisabled={isDisabled}
      aria-description={showCost ? t.runCost(generation.cost) : undefined}
      isPending={generation.submitting}
      className="primary-action variation-generate"
      onPress={() => {
        void generation
          .submit()
          .then(onComplete)
          .catch(() => undefined);
      }}
    >
      {generation.submitting && (
        <Spinner size="md" color="current" role="status" aria-label={t.submitting} />
      )}
      {generation.pending ? t.confirmLastSubmission : t.startGenerating}
      {showCost && (
        <span className="generate-credit-cost" aria-hidden="true">
          <CreditCoin />
          <span>{generation.cost}</span>
        </span>
      )}
    </Button>
  );
}

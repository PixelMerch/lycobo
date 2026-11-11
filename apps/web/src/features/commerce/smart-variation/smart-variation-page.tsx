import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useState } from "react";
import { ReferencePrompt } from "../../../components/reference-prompt/reference-prompt";
import { GenerateButton } from "../../generation/composer/generate-button";
import { HomeRatioPicker } from "../../generation/composer/ratio-picker";
import { SelectionHighlight } from "../../generation/composer/selection-highlight";
import { ReferencePicker } from "../../generation/references/reference-picker";
import { WorkspaceComposerTitle } from "../../workspace/workspace-tool-symbol";
import { useSmartVariationDraft } from "./smart-variation-state";
import { useVariationPlan } from "./use-variation-plan";
import { VariationPlanPanel } from "./variation-plan-panel";
import "../textile-set/textile-set.css";
import "./smart-variation.css";
import { useMessages } from "../../../i18n/messages";
import { variationMessages } from "./variation-messages";

/** 套图计划的参数面板：参考图、创作需求、比例与分辨率，生成计划后打开确认面板。 */
export function SmartVariationPage() {
  const { references, description, ratio, resolution, update } = useSmartVariationDraft();
  const [planOpen, setPlanOpen] = useState(false);
  const analysis = useVariationPlan();
  const planId = useSmartVariationDraft((state) => state.planId);
  const t = useMessages(variationMessages);

  return (
    <>
      <section className="composer-panel" aria-label={t.parameters}>
        <div className="composer-scroll">
          <WorkspaceComposerTitle />
          <ReferencePicker
            compact
            withRoles
            references={references}
            prompt={description}
            onChange={(references, description) => update({ references, description })}
          />
          <ReferencePrompt
            className="prompt-field"
            label={t.brief}
            isRequired
            value={description}
            onChange={(description) => update({ description })}
            references={references}
            onReferencesInsert={(images, description) =>
              update({ references: [...references, ...images], description })
            }
            placeholder={t.briefPlaceholder}
            optimizeTool="variation"
            maxLength={5000}
            showCount
            autoGrow
          />
          <section className="parameter-group" aria-label={t.aspectRatio}>
            <div className="field-title">
              <h2>{t.aspectRatio}</h2>
              <span className="ratio-current">{ratio}</span>
            </div>
            <HomeRatioPicker value={ratio} onChange={(value) => update({ ratio: value })} />
          </section>
          <section className="parameter-group">
            <div className="field-title">
              <h2>{t.resolution}</h2>
            </div>
            <ToggleButtonGroup
              aria-label={t.resolution}
              className="parameter-options"
              isDetached
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[resolution]}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0];
                if (value) update({ resolution: String(value) });
              }}
            >
              {["1.5K", "2K", "4K"].map((value) => (
                <ToggleButton key={value} id={value}>
                  {resolution === value && (
                    <SelectionHighlight layoutId="smart-variation-resolution" />
                  )}
                  <span>{value}</span>
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </section>
        </div>
        <div className="generate-area variation-submit">
          {planId && (
            <Button
              variant="tertiary"
              size="sm"
              className="variation-example-button"
              onPress={() => setPlanOpen(true)}
            >
              {t.viewPlan}
            </Button>
          )}
          <GenerateButton
            label={t.generatePlan}
            submitting={analysis.isPending}
            isDisabled={!analysis.canAnalyze}
            submittingLabel={t.generatingPlan}
            onPress={() => {
              setPlanOpen(true);
              analysis.mutate();
            }}
          />
        </div>
      </section>
      <VariationPlanPanel
        isOpen={planOpen}
        onOpenChange={setPlanOpen}
        analyzing={analysis.isPending}
        streamText={analysis.streamText}
        readingWeb={analysis.readingWeb}
        analysisError={analysis.error?.message}
      />
    </>
  );
}

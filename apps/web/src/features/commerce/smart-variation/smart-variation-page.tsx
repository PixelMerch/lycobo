import { Button } from "@heroui/react";
import { publicImageResolutions } from "@lycoboai/contracts";
import { useState } from "react";
import { ReferencePrompt } from "../../../components/reference-prompt/reference-prompt";
import { GenerateButton } from "../../generation/composer/generate-button";
import { ParameterGroup } from "../../generation/composer/parameter-group";
import { AspectRatioField } from "../../generation/composer/ratio-picker";
import { ReferencePicker } from "../../generation/references/reference-picker";
import { WorkspaceComposerScroll } from "../../workspace/workspace-composer-scroll";
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
        <WorkspaceComposerScroll>
          <WorkspaceComposerTitle />
          <ReferencePicker
            compact
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
          <AspectRatioField
            label={t.aspectRatio}
            value={ratio}
            onChange={(value) => update({ ratio: value })}
          />
          <ParameterGroup
            label={t.resolution}
            values={publicImageResolutions}
            value={resolution}
            onChange={(resolution) => update({ resolution })}
          />
        </WorkspaceComposerScroll>
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
            successLabel={t.planReady}
            onPress={async () => {
              setPlanOpen(true);
              return analysis.submit();
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

import { Button, Spinner, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useState } from "react";
import { ReferencePrompt } from "../../../components/reference-prompt";
import { HomeRatioPicker } from "../../generation/composer/ratio-picker";
import { SelectionHighlight } from "../../generation/composer/selection-highlight";
import { ReferencePicker } from "../../generation/references/reference-picker";
import { WorkspaceComposerTitle } from "../../workspace/workspace-tool-symbol";
import { useSmartVariationDraft } from "./smart-variation-state";
import { useVariationPlan } from "./use-variation-plan";
import { VariationPlanPanel } from "./variation-plan-panel";
import "../textile-set/textile-set.css";
import "./smart-variation.css";

export function SmartVariationPage() {
  const { references, description, ratio, resolution, update } = useSmartVariationDraft();
  const [planOpen, setPlanOpen] = useState(false);
  const analysis = useVariationPlan();
  const planId = useSmartVariationDraft((state) => state.planId);

  return (
    <>
      <section className="composer-panel" aria-label="套图计划参数">
        <WorkspaceComposerTitle />
        <div className="composer-scroll">
          <ReferencePicker
            compact
            references={references}
            prompt={description}
            onChange={(references, description) => update({ references, description })}
          />
          <ReferencePrompt
            className="prompt-field"
            label="创作需求"
            value={description}
            onChange={(description) => update({ description })}
            references={references}
            onReferencesInsert={(images, description) =>
              update({ references: [...references, ...images], description })
            }
            placeholder="描述整套图片的用途、场景和卖点，输入 @ 引用商品图"
            maxLength={5000}
            showCount
            autoGrow
          />
          <section className="parameter-group" aria-label="图片比例">
            <div className="field-title">
              <h2>图片比例</h2>
              <span className="ratio-current">{ratio}</span>
            </div>
            <HomeRatioPicker value={ratio} onChange={(value) => update({ ratio: value })} />
          </section>
          <section className="parameter-group">
            <div className="field-title">
              <h2>分辨率</h2>
            </div>
            <ToggleButtonGroup
              aria-label="分辨率"
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
              查看生成计划
            </Button>
          )}
          <Button
            isDisabled={!analysis.canAnalyze}
            isPending={analysis.isPending}
            onPress={() =>
              analysis.mutate(undefined, {
                onSuccess: (plan) => {
                  if (useSmartVariationDraft.getState().planId === plan.id) setPlanOpen(true);
                },
              })
            }
            variant="primary"
            size="lg"
            fullWidth
            className="primary-action generation-submit"
          >
            {analysis.isPending && (
              <Spinner size="md" color="current" role="status" aria-label="正在生成计划" />
            )}
            {analysis.isPending ? "正在生成计划" : "生成计划"}
          </Button>
        </div>
      </section>
      <VariationPlanPanel isOpen={planOpen} onOpenChange={setPlanOpen} />
    </>
  );
}

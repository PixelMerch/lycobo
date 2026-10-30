import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useState } from "react";
import { ReferencePrompt } from "../../../components/reference-prompt";
import { HomeRatioPicker } from "../../generation/composer/ratio-picker";
import { SelectionHighlight } from "../../generation/composer/selection-highlight";
import { ReferencePicker } from "../../generation/references/reference-picker";
import { WorkspaceComposerTitle } from "../../workspace/workspace-tool-symbol";
import { useSmartVariationDraft } from "./smart-variation-state";
import { VariationPlanDialog } from "./variation-plan-dialog";
import "../textile-set/textile-set.css";
import "./smart-variation.css";

export function SmartVariationPage() {
  const { references, description, ratio, resolution, update } = useSmartVariationDraft();
  const [planOpen, setPlanOpen] = useState(false);
  return (
    <>
      <section className="composer-panel" aria-label="智能裂变参数">
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
            placeholder="描述要调整的颜色、场景或细节，输入 @ 引用图片"
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
          <Button
            variant="tertiary"
            size="sm"
            className="variation-example-button"
            onPress={() => setPlanOpen(true)}
          >
            查看计划示例
          </Button>
          <Button
            isDisabled
            variant="primary"
            size="lg"
            fullWidth
            className="primary-action generation-submit"
          >
            生成计划
          </Button>
          <p>智能分析暂未开放</p>
        </div>
      </section>
      <VariationPlanDialog isOpen={planOpen} onOpenChange={setPlanOpen} />
    </>
  );
}

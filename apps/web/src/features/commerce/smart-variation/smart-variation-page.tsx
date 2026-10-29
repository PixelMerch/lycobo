import { Button, Label, TextArea, TextField, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useState } from "react";
import { HomeRatioPicker } from "../../generation/composer/ratio-picker";
import { SelectionHighlight } from "../../generation/composer/selection-highlight";
import { ModelSelect } from "../../generation/models/model-select";
import { TextileImageField } from "../textile-set/textile-image-field";
import { useSmartVariationDraft } from "./smart-variation-state";
import { VariationPlanDialog } from "./variation-plan-dialog";
import "../textile-set/textile-set.css";
import "./smart-variation.css";

export function SmartVariationPage() {
  const { image, description, model, ratio, resolution, update } = useSmartVariationDraft();
  const [planOpen, setPlanOpen] = useState(false);
  return (
    <>
      <section className="composer-panel" aria-label="智能裂变参数">
        <div className="composer-scroll">
          <TextileImageField
            label="商品图"
            required
            description="上传清晰商品图，完整展示商品"
            exampleSrc="/studio/bedroom-thumb.webp"
            value={image ? [image] : []}
            onChange={(images) => update({ image: images[0] ?? null })}
            number={1}
          />
          <TextField
            className="parameter-group variation-description"
            value={description}
            onChange={(value) => update({ description: value })}
          >
            <Label>创作需求</Label>
            <TextArea
              rows={6}
              maxLength={5000}
              placeholder="例如：把被子和枕套换成橙色、粉色、灰色，白色部分不变，每种颜色生成一张图。"
            />
            <span className="variation-character-count">{description.length}/5000</span>
          </TextField>
          <section className="parameter-group" aria-label="图片比例">
            <div className="field-title">
              <h2>图片比例</h2>
              <span className="ratio-current">{ratio}</span>
            </div>
            <HomeRatioPicker value={ratio} onChange={(value) => update({ ratio: value })} />
          </section>
          <section className="parameter-group">
            <h2>分辨率</h2>
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
          <ModelSelect value={model} onChange={(model) => update({ model })} />
          <Button variant="secondary" onPress={() => setPlanOpen(true)}>
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
          <p>智能分析暂未开放，可先查看计划示例</p>
        </div>
      </section>
      <VariationPlanDialog isOpen={planOpen} onOpenChange={setPlanOpen} />
    </>
  );
}

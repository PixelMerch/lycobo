import { Button, Label, TextArea, TextField, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconArrowRight, IconClipboardText, IconPhoto, IconSparkles } from "@tabler/icons-react";
import { useState } from "react";
import { RouteLink } from "../../../components/router-link";
import { UiIcon } from "../../../components/ui-icon";
import { HomeRatioPicker } from "../../generation/composer/ratio-picker";
import { SelectionHighlight } from "../../generation/composer/selection-highlight";
import { TextileImageField } from "../textile-set/textile-image-field";
import { useSmartVariationDraft } from "./smart-variation-state";
import { VariationPlanDialog } from "./variation-plan-dialog";
import "../textile-set/textile-set.css";
import "./smart-variation.css";

export function SmartVariationPage() {
  const { image, description, ratio, resolution, update } = useSmartVariationDraft();
  const [planOpen, setPlanOpen] = useState(false);
  return (
    <div className="workspace smart-variation-workspace">
      <section className="composer-panel" aria-label="智能裂变参数">
        <div className="composer-scroll">
          <h1 className="textile-title">智能裂变</h1>
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
      <section className="results-panel variation-introduction" aria-label="创作计划">
        <div className="variation-intro-heading">
          <span className="variation-eyebrow">从一张商品图开始</span>
          <h2>先确认创意，再批量生成</h2>
          <p>将商品与需求整理为逐张创作方案，确认每个方向后，再开始生成。</p>
        </div>
        <ol className="variation-steps">
          <li>
            <UiIcon icon={IconPhoto} size="action" />
            <div>
              <h3>上传商品图</h3>
              <p>保留商品主体，描述想调整的颜色、场景或视角。</p>
            </div>
          </li>
          <li>
            <UiIcon icon={IconClipboardText} size="action" />
            <div>
              <h3>确认逐张提示词</h3>
              <p>每张图一个方案，可修改名称和描述、勾选或删除。</p>
            </div>
          </li>
          <li>
            <UiIcon icon={IconSparkles} size="action" />
            <div>
              <h3>生成独立商品图</h3>
              <p>按确认的方案生成，图片可分别查看和下载。</p>
            </div>
          </li>
        </ol>
        <div className="variation-example-entry">
          <div>
            <h3>看看计划如何确认</h3>
            <p>以商品换色为例，预览 9 个可编辑方案。</p>
          </div>
          <Button variant="secondary" onPress={() => setPlanOpen(true)}>
            查看计划示例
            <UiIcon icon={IconArrowRight} />
          </Button>
        </div>
      </section>
      <aside className="variation-history-index" aria-label="智能裂变素材">
        <RouteLink to="/assets">
          我的素材
          <UiIcon icon={IconArrowRight} size="small" />
        </RouteLink>
        <p>生成后的图片将在这里展示</p>
      </aside>
      <VariationPlanDialog isOpen={planOpen} onOpenChange={setPlanOpen} />
    </div>
  );
}

import { type Selection, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useMessages } from "../../../i18n/messages";
import { referenceDisplaySource } from "../../generation/references/reference-display";
import type { ReferenceImage } from "../../generation/studio-state";
import { type PlanUsage, planImages, usePlanBindings } from "./plan-image-bindings";
import { variationMessages } from "./variation-messages";

/**
 * 方案卡片里的“用图”一行：商品和风格图共用，原图（标的或按提示词推断的）按方案逐张对应，点按可切换。
 * 生成时每条方案只发送这一行里点亮的图片。
 */
export function PlanReferenceStrip({
  itemId,
  planNumber,
  prompt,
  references,
  usage,
}: {
  itemId: string;
  planNumber: number;
  prompt: string;
  references: ReferenceImage[];
  usage: PlanUsage;
}) {
  const t = useMessages(variationMessages);
  const override = usePlanBindings((state) => state.bindings[itemId]);
  const setBinding = usePlanBindings((state) => state.setBinding);
  if (!references.length) return null;
  const { shared, sources, bound } = planImages(references, usage, prompt, override);
  const imageOf = (number: number) => references[number - 1];
  function select(keys: Selection) {
    if (keys === "all") return;
    setBinding(
      itemId,
      sources.filter((number) => keys.has(String(number))),
    );
  }
  return (
    <div className="plan-images">
      <span className="plan-images-label">{t.usesImages}</span>
      {shared.length > 0 && (
        <span className="plan-images-group">
          {shared.map((number) => {
            const image = imageOf(number);
            return image ? (
              <span key={image.id} className="plan-image" data-shared="true">
                <img src={referenceDisplaySource(image, true)} alt="" />
                <span className="plan-image-number">{number}</span>
              </span>
            ) : null;
          })}
          <small>{t.sharedImages}</small>
        </span>
      )}
      {sources.length > 0 && (
        <ToggleButtonGroup
          className="plan-images-group"
          aria-label={t.planImages(planNumber)}
          selectionMode="multiple"
          selectedKeys={sources.filter((number) => bound.has(number)).map(String)}
          onSelectionChange={select}
        >
          {sources.map((number) => {
            const image = imageOf(number);
            return image ? (
              <ToggleButton
                key={image.id}
                id={String(number)}
                isIconOnly
                className="plan-image"
                aria-label={t.sourceImage(number)}
              >
                <img src={referenceDisplaySource(image, true)} alt="" />
                <span className="plan-image-number">{number}</span>
              </ToggleButton>
            ) : null;
          })}
        </ToggleButtonGroup>
      )}
    </div>
  );
}

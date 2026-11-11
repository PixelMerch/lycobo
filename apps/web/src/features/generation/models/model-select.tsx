import { Label, ListBox, Select } from "@heroui/react";
import { mainImageModelIds } from "@lycoboai/contracts";
import { useMessages } from "../../../i18n/messages";
import { isModelId, type ModelId } from "../studio-state";
import { ModelLogo, useModelPresentation } from "./model-logos";
import { modelMessages } from "./model-messages";
/** 主图制作按固定顺序展示可选模型，历史展示资料仍保留全部型号。 */
export function ModelSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (model: ModelId) => void;
}) {
  const catalog = useModelPresentation();
  const t = useMessages(modelMessages);
  const models = mainImageModelIds.flatMap((id) =>
    (catalog.data?.models ?? []).filter((model) => model.id === id),
  );
  const selectedModel = models.find((model) => model.id === value);
  return (
    <Select
      className="model-field"
      aria-label={t.creationModel}
      value={value}
      onChange={(key) => {
        if (isModelId(key)) onChange(key);
      }}
    >
      <Label className="model-field-label">{t.model}</Label>
      <Select.Trigger className="model-select">
        <Select.Value>
          <span className="model-selector-name">
            <ModelLogo src={selectedModel?.logoUrl} size="compact" />
            <span>{selectedModel?.name}</span>
          </span>
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="model-menu" placement="bottom start">
        <ListBox aria-label={t.creationModel}>
          {models.map((model) => (
            <ListBox.Item
              className="model-options"
              key={model.id}
              id={model.id}
              textValue={model.name ?? model.id}
            >
              <span className="model-selector-name">
                <ModelLogo src={model.logoUrl} size="compact" />
                <span>{model.name ?? model.id}</span>
              </span>
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

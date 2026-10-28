import { Label, ListBox, Select } from "@heroui/react";
import { isModelId, type ModelId } from "../studio-state";
import { useModelPresentation } from "./model-logos";
export function ModelSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (model: ModelId) => void;
}) {
  const catalog = useModelPresentation();
  const models = catalog.data?.models ?? [];
  return (
    <Select
      className="model-field"
      aria-label="创作模型"
      value={value}
      onChange={(key) => {
        if (isModelId(key)) onChange(key);
      }}
    >
      <Label className="model-field-label">模型</Label>
      <Select.Trigger className="model-select">
        <Select.Value>{models.find((model) => model.id === value)?.name}</Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover className="model-menu" placement="bottom start">
        <ListBox aria-label="创作模型">
          {models.map((model) => (
            <ListBox.Item
              className="model-options"
              key={model.id}
              id={model.id}
              textValue={model.name ?? model.id}
            >
              <span>{model.name ?? model.id}</span>
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

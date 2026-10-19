import { Label, ListBox, Select } from "@heroui/react";
import { IconBanana, IconPhoto } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import { isModelId, models } from "./studio-state";
export function ModelSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (model: "gpt-image" | "banana") => void;
}) {
  // Imported here keeps model choice identical wherever it is presented.
  const selected = models.find((m) => m.id === value) ?? models[0];
  return <ModelSelectControl value={selected.id} onChange={onChange} />;
}

function ModelSelectControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (model: "gpt-image" | "banana") => void;
}) {
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
      <Select.Popover placement="bottom start">
        <ListBox aria-label="创作模型">
          {models.map((model) => (
            <ListBox.Item
              className="model-options"
              key={model.id}
              id={model.id}
              textValue={model.name}
            >
              <UiIcon icon={model.id === "banana" ? IconBanana : IconPhoto} />
              <span>{model.name}</span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { SelectionPill } from "../../../components/selection-pill";

/** 创作参数的单选按钮组，支持禁用选项和自定义显示名称。 */
export function ParameterGroup({
  label,
  values,
  value,
  onChange,
  disabledValues = [],
  optionLabel = (option) => option,
}: {
  label: string;
  values: readonly string[];
  disabledValues?: readonly string[];
  value: string;
  onChange: (value: string) => void;
  optionLabel?: (option: string) => string;
}) {
  return (
    <fieldset className="parameter-group">
      <legend>{label}</legend>
      <ToggleButtonGroup
        aria-label={label}
        className="parameter-options parameter-options-pill"
        disallowEmptySelection
        isDetached
        selectedKeys={[value]}
        selectionMode="single"
        onSelectionChange={(keys) => {
          const [next] = [...keys];
          if (next !== undefined) onChange(String(next));
        }}
      >
        {values.map((option) => (
          <ToggleButton key={option} id={option} isDisabled={disabledValues.includes(option)}>
            <span>{optionLabel(option)}</span>
          </ToggleButton>
        ))}
        {values.includes(value) && !disabledValues.includes(value) && (
          <SelectionPill value={value} />
        )}
      </ToggleButtonGroup>
    </fieldset>
  );
}

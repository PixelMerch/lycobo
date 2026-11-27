import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { DataSkeleton } from "../../../components/data-skeleton";
import { SelectionPill } from "../../../components/selection-pill";

/** 创作参数的单选按钮组，支持禁用选项和自定义显示名称。 */
export function ParameterGroup<Value extends string>({
  label,
  values,
  value,
  onChange,
  loading = false,
  disabledValues = [],
  optionLabel = (option) => option,
}: {
  label: string;
  loading?: boolean;
  values: readonly Value[];
  disabledValues?: readonly Value[];
  value: Value;
  onChange: (value: Value) => void;
  optionLabel?: (option: Value) => string;
}) {
  if (loading)
    return (
      <fieldset className="parameter-group">
        <legend>{label}</legend>
        <DataSkeleton layout="options" />
      </fieldset>
    );
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
          const next = values.find((option) => keys.has(option));
          if (next !== undefined) onChange(next);
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

import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { SelectionHighlight } from "./selection-highlight";

/** 创作参数里的一行单选，图片与视频工具共用；optionLabel 把选项值换成显示名称。 */
export function ParameterGroup({
  label,
  values,
  value,
  onChange,
  selectionId,
  disabledValues = [],
  optionLabel = (option) => option,
}: {
  label: string;
  values: readonly string[];
  disabledValues?: readonly string[];
  value: string;
  selectionId: string;
  onChange: (value: string) => void;
  optionLabel?: (option: string) => string;
}) {
  return (
    <fieldset className="parameter-group">
      <legend>{label}</legend>
      <ToggleButtonGroup
        aria-label={label}
        className="parameter-options"
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
            {option === value && (
              <SelectionHighlight
                layoutId={`workspace-${selectionId}-selection`}
                layoutDependency={value}
              />
            )}
            <span>{optionLabel(option)}</span>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </fieldset>
  );
}

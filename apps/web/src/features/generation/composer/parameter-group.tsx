import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { SelectionHighlight } from "./selection-highlight";

/** One labelled single-choice row of the composer, shared by the image and video tools. */
export function ParameterGroup({
  label,
  values,
  value,
  onChange,
  selectionId,
  disabledValues = [],
}: {
  label: string;
  values: readonly string[];
  disabledValues?: readonly string[];
  value: string;
  selectionId: string;
  onChange: (value: string) => void;
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
            <span>{option}</span>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </fieldset>
  );
}

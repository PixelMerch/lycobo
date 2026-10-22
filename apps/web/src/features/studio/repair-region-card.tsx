import { Button, TextArea, TextField } from "@heroui/react";
import { IconTrash } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import type { RepairRegion } from "./local-repair-state";

/** A region's user-facing instructions; pixel geometry stays on the canvas. */
export function RepairRegionCard({
  region,
  number,
  selected,
  locked,
  onSelect,
  onRemove,
  onPrompt,
}: {
  region: RepairRegion;
  number: number;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onPrompt: (prompt: string) => void;
}) {
  return (
    <section
      className="repair-region-card"
      id={`repair-region-${region.id}`}
      data-selected={selected}
    >
      <div className="repair-region-heading">
        <Button
          variant="ghost"
          size="sm"
          className="repair-region-select"
          aria-label={`区域 ${number}`}
          onPress={onSelect}
        >
          <span className="repair-badge">{number}</span>区域 {number}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          className="repair-region-remove"
          aria-label={`删除区域 ${number}`}
          isDisabled={locked}
          onPress={onRemove}
        >
          <UiIcon icon={IconTrash} />
        </Button>
      </div>
      <TextField
        aria-label={`区域 ${number} 修改说明`}
        value={region.prompt}
        isDisabled={locked}
        onFocus={onSelect}
        onChange={onPrompt}
      >
        <TextArea rows={4} maxLength={900} placeholder="描述你想修改的内容…" />
      </TextField>
    </section>
  );
}

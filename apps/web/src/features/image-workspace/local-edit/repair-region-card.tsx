import { Button, TextArea, TextField } from "@heroui/react";
import { IconTrash } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { imageWorkspaceMessages } from "../image-workspace-messages";
import type { RepairRegion } from "./local-repair-state";

/** 一个修改区域的说明卡：用户填写修改要求，像素位置留在画布上。 */
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
  const t = useMessages(imageWorkspaceMessages);
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
          aria-label={t.region(number)}
          onPress={onSelect}
        >
          <span className="repair-badge">{number}</span>
          {t.region(number)}
          <span className="required-indicator" aria-hidden="true">
            *
          </span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          className="repair-region-remove"
          aria-label={t.deleteRegion(number)}
          isDisabled={locked}
          onPress={onRemove}
        >
          <UiIcon icon={IconTrash} />
        </Button>
      </div>
      <TextField
        aria-label={t.regionNote(number)}
        isRequired
        value={region.prompt}
        isDisabled={locked}
        onFocus={onSelect}
        onChange={onPrompt}
      >
        <TextArea rows={4} maxLength={900} placeholder={t.regionPlaceholder} />
      </TextField>
    </section>
  );
}

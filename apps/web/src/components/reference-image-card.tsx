import { Button } from "@heroui/react";
import { IconX } from "@tabler/icons-react";
import { UiIcon } from "./ui-icon";

/** Shared reference thumbnail. The caller owns files, ordering and removal state. */
export function ReferenceImageCard({
  src,
  number,
  onRemove,
  isDisabled = false,
}: {
  src: string;
  number: number;
  onRemove: () => void;
  isDisabled?: boolean;
}) {
  return (
    <div className="reference-tile">
      <img src={src} alt={`图片${number}`} style={{ objectFit: "cover" }} />
      <Button
        isIconOnly
        variant="secondary"
        className="remove-reference"
        aria-label={`移除参考图：图片${number}`}
        isDisabled={isDisabled}
        onPress={onRemove}
      >
        <UiIcon icon={IconX} size="small" />
      </Button>
      <span className="reference-number">图片{number}</span>
    </div>
  );
}

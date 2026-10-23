import { Button } from "@heroui/react";
import { IconReplace, IconX } from "@tabler/icons-react";
import { UiIcon } from "./ui-icon";
import "./reference-image-card.css";

/**
 * Shared reference thumbnail. The caller owns files, ordering and removal state.
 * The picture is the preview trigger and the corner control only removes, so a
 * delete press can never open the viewer.
 */
export function ReferenceImageCard({
  src,
  number,
  showNumber = true,
  onOpen,
  onRemove,
  onReplace,
  isDisabled = false,
}: {
  src: string;
  number: number;
  showNumber?: boolean;
  onOpen: () => void;
  onRemove: () => void;
  onReplace?: () => void;
  isDisabled?: boolean;
}) {
  return (
    <div className="reference-tile reference-image-card">
      <Button
        variant="ghost"
        className="reference-preview"
        aria-label={`查看参考图片：图片${number}`}
        isDisabled={isDisabled}
        onPress={onOpen}
      >
        <img src={src} alt="" draggable={false} />
      </Button>
      {onReplace && (
        <Button
          isIconOnly
          size="sm"
          variant="tertiary"
          className="replace-reference"
          aria-label={`替换参考图：图片${number}`}
          isDisabled={isDisabled}
          onPress={onReplace}
        >
          <UiIcon icon={IconReplace} size="navigation" />
        </Button>
      )}
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
      {showNumber && (
        <span className="reference-number" aria-hidden="true">
          {number}
        </span>
      )}
    </div>
  );
}

import { Button } from "@heroui/react";
import { IconPencil, IconX } from "@tabler/icons-react";
import { UiIcon } from "../ui-icon";
import "./reference-image-card.css";
import { useMessages } from "../../i18n/messages";
import { componentsMessages } from "../components-messages";

/**
 * 共用参考图缩略图：文件、顺序与删除状态由调用方管理。
 * 点图片打开预览，角上的按钮只负责删除，按删除不会打开浏览器。
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
  const t = useMessages(componentsMessages);
  const name = t.imageName(number);
  return (
    <div className="reference-tile reference-image-card">
      <Button
        variant="ghost"
        className="reference-preview"
        aria-label={t.viewReference(name)}
        isDisabled={isDisabled}
        onPress={onOpen}
      >
        <img src={src} alt="" draggable={false} />
      </Button>
      {onReplace && (
        <Button
          isIconOnly
          variant="secondary"
          className="replace-reference"
          aria-label={t.replaceReference(name)}
          isDisabled={isDisabled}
          onPress={onReplace}
        >
          <UiIcon icon={IconPencil} size="small" />
        </Button>
      )}
      <Button
        isIconOnly
        variant="secondary"
        className="remove-reference"
        aria-label={t.removeReference(name)}
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

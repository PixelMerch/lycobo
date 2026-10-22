import { Modal } from "@heroui/react";
import { IconX } from "@tabler/icons-react";
import { UiIcon } from "./ui-icon";
import "./dialog-close.css";

/**
 * Circular close control shared by the full-screen dialogs. It must render
 * inside a HeroUI Modal so the trigger closes the surrounding dialog.
 */
export function DialogClose({
  label,
  className,
  iconSize = "action",
}: {
  label: string;
  className?: string;
  iconSize?: "default" | "action";
}) {
  return (
    <Modal.CloseTrigger
      className={className ? `dialog-close ${className}` : "dialog-close"}
      aria-label={label}
    >
      <UiIcon icon={IconX} size={iconSize} />
    </Modal.CloseTrigger>
  );
}

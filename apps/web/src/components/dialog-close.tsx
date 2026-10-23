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
  fullScreen = false,
}: {
  label: string;
  className?: string;
  fullScreen?: boolean;
}) {
  return (
    <Modal.CloseTrigger
      className={`dialog-close${fullScreen ? " dialog-close--fullscreen" : ""}${className ? ` ${className}` : ""}`}
      aria-label={label}
    >
      <UiIcon icon={IconX} size={fullScreen ? "illustration" : "action"} />
    </Modal.CloseTrigger>
  );
}

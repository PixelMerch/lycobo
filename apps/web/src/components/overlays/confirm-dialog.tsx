import { Button, Modal } from "@heroui/react";
import type { ReactNode } from "react";
import { DialogClose } from "./dialog-close";
import "./confirm-dialog.css";
import { useMessages } from "../../i18n/messages";
import { componentsMessages } from "../components-messages";

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  content: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  closeLabel?: string;
  tone?: "default" | "danger";
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** 共用确认弹窗：调用方管理开关状态，并在回调里关闭。 */
export function ConfirmDialog({
  isOpen,
  title,
  content,
  confirmLabel,
  cancelLabel,
  closeLabel,
  tone = "default",
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const t = useMessages(componentsMessages);
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <Modal.Backdrop className="confirm-dialog__backdrop">
        <Modal.Container>
          <Modal.Dialog className="confirm-dialog" data-tone={tone}>
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
              <DialogClose label={closeLabel ?? t.closeConfirm} />
            </Modal.Header>
            <Modal.Body>
              <div className="confirm-dialog__content">{content}</div>
              <div className="confirm-dialog__actions">
                <Button
                  variant="secondary"
                  className="confirm-dialog__cancel"
                  isDisabled={isPending}
                  onPress={onCancel}
                >
                  {cancelLabel ?? t.cancel}
                </Button>
                <Button
                  className="confirm-dialog__confirm"
                  isDisabled={isPending}
                  onPress={onConfirm}
                >
                  {confirmLabel ?? t.confirm}
                </Button>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

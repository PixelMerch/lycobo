import { Button, Modal } from "@heroui/react";
import type { ReactNode } from "react";
import "./confirm-dialog.css";

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

/** Shared confirmation dialog; callers own open state and close in the callbacks. */
export function ConfirmDialog({
  isOpen,
  title,
  content,
  confirmLabel = "确认",
  cancelLabel = "取消",
  closeLabel = "关闭确认弹窗",
  tone = "default",
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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
              <Modal.CloseTrigger aria-label={closeLabel} />
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
                  {cancelLabel}
                </Button>
                <Button
                  className="confirm-dialog__confirm"
                  isDisabled={isPending}
                  onPress={onConfirm}
                >
                  {confirmLabel}
                </Button>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

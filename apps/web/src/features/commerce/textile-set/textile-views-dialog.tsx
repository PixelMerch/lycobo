import { Button, Modal, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconCheck } from "@tabler/icons-react";
import { useState } from "react";
import { DialogClose } from "../../../components/dialog-close";
import { UiIcon } from "../../../components/ui-icon";
import { type TextileViewId, textileViews } from "./textile-views";

export function TextileViewsDialog({
  selected,
  onConfirm,
  onClose,
}: {
  selected: TextileViewId[];
  onConfirm: (values: TextileViewId[]) => void;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(selected);
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Backdrop>
        <Modal.Container size="full" scroll="inside">
          <Modal.Dialog className="textile-views-dialog">
            <Modal.Header>
              <Modal.Heading>裂变类型</Modal.Heading>
              <DialogClose label="关闭裂变类型" />
            </Modal.Header>
            <Modal.Body>
              <p className="textile-view-count">已选 {pending.length} 个视角</p>
              <ToggleButtonGroup
                aria-label="裂变视角"
                className="textile-view-grid"
                selectionMode="multiple"
                selectedKeys={pending}
                onSelectionChange={(keys) => {
                  setPending(
                    textileViews.filter((view) => keys.has(view.id)).map((view) => view.id),
                  );
                }}
              >
                {textileViews.map((view) => (
                  <ToggleButton
                    key={view.id}
                    id={view.id}
                    className="textile-view-card"
                    aria-label={view.name}
                  >
                    <span className="textile-view-example" aria-hidden="true" />
                    <span className="textile-view-copy">
                      <strong>{view.name}</strong>
                      <span>{view.description}</span>
                    </span>
                    {pending.includes(view.id) && (
                      <span className="textile-view-check">
                        <UiIcon icon={IconCheck} size="small" />
                      </span>
                    )}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={() => setPending([])}>
                重置
              </Button>
              <Button
                variant="primary"
                className="primary-action"
                onPress={() => {
                  onConfirm(pending);
                  onClose();
                }}
              >
                确定
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

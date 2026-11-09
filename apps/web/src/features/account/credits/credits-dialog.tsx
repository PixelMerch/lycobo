import { Modal } from "@heroui/react";
import { IconX } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { CreditPacks } from "./credit-packs";
import "../account-panel.css";
import "./credit-recharge.css";

/** Credit packs beside an order preview. Payment stays unavailable until it is integrated. */
export function RechargeDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Backdrop className="account-backdrop">
        <Modal.Container>
          <Modal.Dialog className="account-dialog credit-recharge-dialog">
            <Modal.Header>
              <Modal.Heading>充值积分</Modal.Heading>
              <Modal.CloseTrigger aria-label="关闭充值积分">
                <UiIcon icon={IconX} size="action" />
              </Modal.CloseTrigger>
            </Modal.Header>
            <Modal.Body>
              <CreditPacks />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

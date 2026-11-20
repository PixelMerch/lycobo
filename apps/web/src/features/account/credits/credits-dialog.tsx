import { Modal } from "@heroui/react";
import { IconX } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { CreditPacks } from "./credit-packs";
import { creditsMessages } from "./credits-messages";
import "../account-panel.css";
import "./credit-recharge.css";

/** 充值积分弹窗：积分包与订单预览；支付接入前不能下单。 */
export function RechargeDialog({ onClose }: { onClose: () => void }) {
  const t = useMessages(creditsMessages);
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
              <Modal.Heading>{t.recharge}</Modal.Heading>
              <Modal.CloseTrigger aria-label={t.closeRecharge}>
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

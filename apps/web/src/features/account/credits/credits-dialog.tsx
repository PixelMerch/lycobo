import { Modal } from "@heroui/react";
import { motion } from "motion/react";
import { DialogClose } from "../../../components/overlays/dialog-close";
import { useCenteredDialogEntrance } from "../../../components/overlays/use-centered-dialog-entrance";
import { useMessages } from "../../../i18n/messages";
import { serverErrorMessages } from "../../../lib/server-error-messages";
import "../../../styles/fullscreen-dialog.css";
import { CreditPacks } from "./credit-packs";
import { creditsMessages } from "./credits-messages";
import "./credit-recharge.css";

/** 展示积分包，并在生成因积分不足被拒绝时说明打开原因。 */
export function RechargeDialog({
  insufficient,
  onClose,
}: {
  insufficient: boolean;
  onClose: () => void;
}) {
  const t = useMessages(creditsMessages);
  const errors = useMessages(serverErrorMessages);
  const surfaceMotion = useCenteredDialogEntrance();
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Backdrop className="fullscreen-dialog__backdrop credit-recharge-backdrop">
        <Modal.Container className="fullscreen-dialog__container" size="full">
          <Modal.Dialog className="credit-recharge-dialog">
            <motion.div className="credit-recharge-surface" {...surfaceMotion}>
              <Modal.Header className="credit-recharge-heading">
                <Modal.Heading>{t.recharge}</Modal.Heading>
                <p>{insufficient ? errors.codes.INSUFFICIENT_CREDITS : t.rechargeDescription}</p>
                <DialogClose fullScreen label={t.closeRecharge} className="credit-recharge-close" />
              </Modal.Header>
              <Modal.Body className="credit-recharge-body">
                <div className="credit-recharge-content">
                  <CreditPacks />
                </div>
              </Modal.Body>
            </motion.div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

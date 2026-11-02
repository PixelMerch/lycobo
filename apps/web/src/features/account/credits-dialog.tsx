import { Modal } from "@heroui/react";
import { IconX } from "@tabler/icons-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { UiIcon } from "../../components/ui-icon";
import { CreditPacks } from "./credit-packs";
import { WalletPanel } from "./wallet-panel";
import "./account-panel.css";
import "./credit-recharge.css";

/** One official focus scope survives recharge/detail transitions. Membership is a route. */
export function CreditsDialog({
  onClose,
  initialView = "recharge",
}: {
  onClose: () => void;
  initialView?: "recharge" | "billing";
}) {
  const [view, setView] = useState(initialView);
  const navigate = useNavigate();
  const location = useLocation();
  const title = view === "recharge" ? "积分充值" : "订阅与账单";
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Backdrop className="account-backdrop">
        <Modal.Container>
          <Modal.Dialog
            className={`account-dialog ${view === "recharge" ? "credit-recharge-dialog" : "account-dialog--credits"}`}
          >
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
              <Modal.CloseTrigger aria-label={`关闭${title}`}>
                <UiIcon icon={IconX} size="action" />
              </Modal.CloseTrigger>
            </Modal.Header>
            <Modal.Body>
              {view === "recharge" ? (
                <CreditPacks />
              ) : (
                <WalletPanel
                  onRecharge={() => setView("recharge")}
                  onMembership={() => {
                    onClose();
                    if (location.pathname !== "/membership")
                      navigate("/membership", {
                        state: { returnTo: location.pathname + location.search },
                      });
                  }}
                />
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

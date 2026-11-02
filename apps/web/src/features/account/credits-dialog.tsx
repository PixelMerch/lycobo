import { Button, Modal } from "@heroui/react";
import { IconX } from "@tabler/icons-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { CreditCoin } from "../../components/credit-coin";
import { UiIcon } from "../../components/ui-icon";
import { CreditPacks } from "./credit-packs";
import { useWallet } from "./wallet-client";
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
  const wallet = useWallet();
  const [view, setView] = useState(initialView);
  const navigate = useNavigate();
  const location = useLocation();
  const title = view === "recharge" ? "充值积分" : "订阅与账单";
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
                <>
                  <div className="credit-recharge-balance">
                    <div>
                      <span>企业共享积分</span>
                      <strong>
                        <CreditCoin size="action" />
                        {wallet.data?.balance.toLocaleString("zh-CN") ?? "—"}
                      </strong>
                    </div>
                    <Button size="sm" variant="ghost" onPress={() => setView("billing")}>
                      积分明细
                    </Button>
                  </div>
                  {wallet.isError && (
                    <p className="credit-recharge-note">余额暂不可用，请在积分明细中重试。</p>
                  )}
                  <CreditPacks />
                </>
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

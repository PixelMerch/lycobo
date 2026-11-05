import { Modal, Tabs } from "@heroui/react";
import { IconX } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import { useEnterpriseSession } from "../auth/auth-client";
import { type AccountCenterTab, accountCenterTabs } from "./account-center-tabs";
import { useAccountOverlays } from "./account-overlay-store";
import { AccountProfile } from "./account-profile";
import { CreditLedger } from "./credit-ledger";
import { RechargeOrders } from "./recharge-orders";
import "./account-panel.css";
import "./account-center.css";

/**
 * The account center opens above the current page, so drafts and the URL stay as they are.
 * Only the selected tab mounts, so each tab reads (and reports failures for) its own data.
 */
export function AccountCenterDialog({
  tab,
  onClose,
}: {
  tab: AccountCenterTab;
  onClose: () => void;
}) {
  const session = useEnterpriseSession();
  const selectTab = useAccountOverlays((state) => state.selectTab);
  const account = session.data;
  if (!account) return null;
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Backdrop className="account-backdrop">
        <Modal.Container>
          <Modal.Dialog className="account-dialog account-center-dialog">
            <Modal.Header>
              <Modal.Heading>积分与账单</Modal.Heading>
              <Modal.CloseTrigger aria-label="关闭积分与账单">
                <UiIcon icon={IconX} size="action" />
              </Modal.CloseTrigger>
            </Modal.Header>
            <Modal.Body className="account-center">
              <AccountProfile account={account} />
              <Tabs
                selectedKey={tab}
                onSelectionChange={(key) => {
                  const next = accountCenterTabs.find((item) => item.id === key);
                  if (next) selectTab(next.id);
                }}
                className="account-center-tabs"
              >
                <Tabs.ListContainer>
                  <Tabs.List aria-label="积分与账单">
                    {accountCenterTabs.map((item) => (
                      <Tabs.Tab key={item.id} id={item.id}>
                        {item.label}
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>
                </Tabs.ListContainer>
                <Tabs.Panel id="credits">
                  <CreditLedger />
                </Tabs.Panel>
                <Tabs.Panel id="orders">
                  <RechargeOrders />
                </Tabs.Panel>
              </Tabs>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

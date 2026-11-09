import { Modal, Tabs } from "@heroui/react";
import { IconX } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { useEnterpriseSession } from "../../auth/auth-client";
import { useAccountOverlays } from "../account-overlay-store";
import { CreditLedger } from "../credits/credit-ledger";
import { RechargeOrders } from "../credits/recharge-orders";
import { accountCenterMessages } from "./account-center-messages";
import { type AccountCenterTab, accountCenterTabs } from "./account-center-tabs";
import { AccountProfile } from "./account-profile";
import "../account-panel.css";
import "./account-center.css";

/**
 * 积分与账单弹窗叠在当前页面之上，草稿与地址保持不变；
 * 只挂载选中的页签，各页签自己读取数据并报告失败。
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
  const t = useMessages(accountCenterMessages);
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
              <Modal.Heading>{t.title}</Modal.Heading>
              <Modal.CloseTrigger aria-label={t.close}>
                <UiIcon icon={IconX} size="action" />
              </Modal.CloseTrigger>
            </Modal.Header>
            <Modal.Body className="account-center">
              <AccountProfile account={account} />
              <Tabs
                selectedKey={tab}
                onSelectionChange={(key) => {
                  const next = accountCenterTabs.find((id) => id === key);
                  if (next) selectTab(next);
                }}
                className="account-center-tabs"
              >
                <Tabs.ListContainer>
                  <Tabs.List aria-label={t.title}>
                    {accountCenterTabs.map((id) => (
                      <Tabs.Tab key={id} id={id}>
                        {t.tabs[id]}
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

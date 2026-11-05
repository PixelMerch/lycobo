import { Avatar, Button, Chip, Modal, Tabs } from "@heroui/react";
import { IconCopy, IconX } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import { copyToClipboard } from "../../lib/clipboard";
import { useEnterpriseSession } from "../auth/auth-client";
import { type AccountCenterTab, accountCenterTabs } from "./account-center-tabs";
import { roleLabel } from "./account-format";
import { useAccountOverlays } from "./account-overlay-store";
import { AccountSecurity } from "./account-security";
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
  const initial = Array.from(account.account)[0]?.toUpperCase() ?? "";
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
              <Modal.Heading>个人中心</Modal.Heading>
              <Modal.CloseTrigger aria-label="关闭个人中心">
                <UiIcon icon={IconX} size="action" />
              </Modal.CloseTrigger>
            </Modal.Header>
            <Modal.Body className="account-center">
              <section className="account-profile-card" aria-label="账号信息">
                <Avatar className="account-profile-avatar" aria-hidden="true">
                  <Avatar.Fallback>{initial}</Avatar.Fallback>
                </Avatar>
                <div className="account-profile-main">
                  <strong title={account.account}>{account.account}</strong>
                  <div className="account-profile-meta">
                    <Chip size="sm" className="account-chip">
                      {roleLabel(account.role)}
                    </Chip>
                    <span>{account.uid ? `UID ${account.uid}` : "UID —"}</span>
                    {account.uid && (
                      <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        aria-label="复制 UID"
                        className="account-copy"
                        onPress={() => {
                          if (account.uid) void copyToClipboard(account.uid, "UID 已复制");
                        }}
                      >
                        <UiIcon icon={IconCopy} size="small" />
                      </Button>
                    )}
                  </div>
                </div>
              </section>
              <Tabs
                selectedKey={tab}
                onSelectionChange={(key) => {
                  const next = accountCenterTabs.find((item) => item.id === key);
                  if (next) selectTab(next.id);
                }}
                className="account-center-tabs"
              >
                <Tabs.ListContainer>
                  <Tabs.List aria-label="个人中心">
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
                <Tabs.Panel id="security">
                  <AccountSecurity />
                </Tabs.Panel>
              </Tabs>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

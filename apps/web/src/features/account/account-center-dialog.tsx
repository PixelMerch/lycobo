import { Avatar, Button, Chip, Modal, Tabs } from "@heroui/react";
import { IconCopy, IconSettings, IconX } from "@tabler/icons-react";
import { useRef } from "react";
import { UiIcon } from "../../components/ui-icon";
import { copyToClipboard } from "../../lib/clipboard";
import { useEnterpriseSession } from "../auth/auth-client";
import { type AccountCenterTab, accountCenterTabs } from "./account-center-tabs";
import { roleLabel } from "./account-format";
import { AccountMembership } from "./account-membership";
import { useAccountOverlays } from "./account-overlay-store";
import { AccountOverview } from "./account-overview";
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
  onLeave,
}: {
  tab: AccountCenterTab;
  onClose: () => void;
  onLeave: () => void;
}) {
  const session = useEnterpriseSession();
  const selectTab = useAccountOverlays((state) => state.selectTab);
  const tabs = useRef(new Map<AccountCenterTab, HTMLElement>());
  const account = session.data;
  if (!account) return null;
  const initial = Array.from(account.account)[0]?.toUpperCase() ?? "";
  // Buttons inside a panel unmount with it; focus moves to the tab that is now selected.
  const showTab = (next: AccountCenterTab) => {
    selectTab(next);
    tabs.current.get(next)?.focus({ preventScroll: true });
  };
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
                    <span className="account-profile-dot" aria-hidden="true" />
                    <span>企业账号登录</span>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="account-profile-action"
                  onPress={() => showTab("security")}
                >
                  <UiIcon icon={IconSettings} />
                  账号与安全
                </Button>
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
                      <Tabs.Tab
                        key={item.id}
                        id={item.id}
                        ref={(element: HTMLElement | null) => {
                          if (element) tabs.current.set(item.id, element);
                          else tabs.current.delete(item.id);
                        }}
                      >
                        {item.label}
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>
                </Tabs.ListContainer>
                <Tabs.Panel id="overview">
                  <AccountOverview onShowTab={showTab} onLeave={onLeave} />
                </Tabs.Panel>
                <Tabs.Panel id="credits">
                  <CreditLedger />
                </Tabs.Panel>
                <Tabs.Panel id="orders">
                  <RechargeOrders />
                </Tabs.Panel>
                <Tabs.Panel id="membership">
                  <AccountMembership />
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

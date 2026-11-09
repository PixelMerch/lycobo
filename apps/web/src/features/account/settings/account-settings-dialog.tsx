import { Modal, Tabs } from "@heroui/react";
import { IconShieldLock, IconUserCircle, IconUsersGroup, IconX } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { useEnterpriseSession } from "../../auth/auth-client";
import { useWideViewport } from "../use-wide-viewport";
import { AccountPasswordForm } from "./account-password-form";
import { accountSettingsMessages } from "./account-settings-messages";
import { AccountSettingsMembers, AccountSettingsProfile } from "./account-settings-panels";
import "../account-panel.css";
import "../center/account-center.css";
import "./account-settings.css";

/** 设置弹窗与账单分开；尚未开放的账户服务如实显示，不模拟成功。 */
export function AccountSettingsDialog({ onClose }: { onClose: () => void }) {
  const account = useEnterpriseSession().data;
  const t = useMessages(accountSettingsMessages);
  // 宽屏在左侧列出分区，手机保留可横向滚动的顶部页签。
  const orientation = useWideViewport() ? "vertical" : "horizontal";
  if (!account) return null;
  const canManageMembers = account.role === "admin";
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Backdrop className="account-backdrop">
        <Modal.Container>
          <Modal.Dialog className="account-dialog account-center-dialog account-settings-dialog">
            <Modal.Header>
              <Modal.Heading>{t.title}</Modal.Heading>
              <Modal.CloseTrigger aria-label={t.close}>
                <UiIcon icon={IconX} size="action" />
              </Modal.CloseTrigger>
            </Modal.Header>
            <Modal.Body className="account-center">
              <Tabs
                defaultSelectedKey="profile"
                orientation={orientation}
                className="account-center-tabs settings-tabs"
              >
                <Tabs.ListContainer>
                  <Tabs.List aria-label={t.title}>
                    <Tabs.Tab id="profile">
                      <UiIcon icon={IconUserCircle} />
                      {t.profile}
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab id="security">
                      <UiIcon icon={IconShieldLock} />
                      {t.security}
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    {canManageMembers && (
                      <Tabs.Tab id="members">
                        <UiIcon icon={IconUsersGroup} />
                        {t.members}
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    )}
                  </Tabs.List>
                </Tabs.ListContainer>
                <Tabs.Panel id="profile">
                  <AccountSettingsProfile account={account} />
                </Tabs.Panel>
                <Tabs.Panel id="security">
                  <AccountPasswordForm />
                </Tabs.Panel>
                {canManageMembers && (
                  <Tabs.Panel id="members">
                    <AccountSettingsMembers />
                  </Tabs.Panel>
                )}
              </Tabs>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

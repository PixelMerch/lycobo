import { Modal, Tabs } from "@heroui/react";
import { IconShieldLock, IconUserCircle, IconUsersGroup, IconX } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { useEnterpriseSession } from "../../auth/auth-client";
import { useWideViewport } from "../use-wide-viewport";
import { AccountPasswordForm } from "./account-password-form";
import { AccountSettingsMembers, AccountSettingsProfile } from "./account-settings-panels";
import "../account-panel.css";
import "../center/account-center.css";
import "./account-settings.css";

/** Settings are independent of billing; unavailable account services never simulate success. */
export function AccountSettingsDialog({ onClose }: { onClose: () => void }) {
  const account = useEnterpriseSession().data;
  // Wide screens show a side list of sections; phones keep scrollable top tabs.
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
              <Modal.Heading>设置</Modal.Heading>
              <Modal.CloseTrigger aria-label="关闭设置">
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
                  <Tabs.List aria-label="设置">
                    <Tabs.Tab id="profile">
                      <UiIcon icon={IconUserCircle} />
                      个人资料
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab id="security">
                      <UiIcon icon={IconShieldLock} />
                      登录与安全
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    {canManageMembers && (
                      <Tabs.Tab id="members">
                        <UiIcon icon={IconUsersGroup} />
                        企业成员
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

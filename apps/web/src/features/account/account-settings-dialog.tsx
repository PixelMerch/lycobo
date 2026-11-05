import { Modal, Tabs } from "@heroui/react";
import { IconX } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import { useEnterpriseSession } from "../auth/auth-client";
import { AccountPasswordForm } from "./account-password-form";
import { AccountSettingsMembers, AccountSettingsProfile } from "./account-settings-panels";
import "./account-panel.css";
import "./account-center.css";
import "./account-settings.css";

/** Settings are independent of billing; unavailable account services never simulate success. */
export function AccountSettingsDialog({ onClose }: { onClose: () => void }) {
  const account = useEnterpriseSession().data;
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
              <Tabs defaultSelectedKey="profile" className="account-center-tabs">
                <Tabs.ListContainer>
                  <Tabs.List aria-label="设置">
                    <Tabs.Tab id="profile">
                      个人资料
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab id="security">
                      登录与安全
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    {canManageMembers && (
                      <Tabs.Tab id="members">
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

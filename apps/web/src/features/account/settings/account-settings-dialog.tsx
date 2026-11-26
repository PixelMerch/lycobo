import { Button, Modal, Tabs } from "@heroui/react";
import type { EnterpriseIdentity } from "@lycoboai/contracts";
import {
  IconChartBar,
  IconKey,
  IconLogout,
  IconShieldLock,
  IconUserCircle,
  IconUsersGroup,
  IconX,
  type TablerIcon,
} from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { useErrorToast } from "../../../lib/error-toast";
import { useEnterpriseLogout, useEnterpriseSession } from "../../auth/auth-client";
import { accountDisplayName, roleLabel } from "../account-format";
import { useAccountOverlays } from "../account-overlay-store";
import { AccountAvatar } from "../avatar/account-avatar";
import { useWideViewport } from "../use-wide-viewport";
import { AccountImageAutomation } from "./account-image-automation";
import { AccountPasswordForm } from "./account-password-form";
import { AccountPlanUsage } from "./account-plan-usage";
import { accountSettingsMessages } from "./account-settings-messages";
import { AccountSettingsMembers, AccountSettingsProfile } from "./account-settings-panels";
import { type SettingsSection, settingsSections } from "./settings-sections";
import "../account-panel.css";
import "../center/account-center.css";
import "./account-settings.css";

const sectionIcons: Record<SettingsSection, TablerIcon> = {
  account: IconUserCircle,
  plan: IconChartBar,
  security: IconShieldLock,
  automation: IconKey,
  members: IconUsersGroup,
};

/** 左侧栏顶部的身份：头像、账号与 UID · 角色。 */
function SettingsIdentity({ account }: { account: EnterpriseIdentity }) {
  const locale = useLocale();
  const t = useMessages(accountSettingsMessages);
  return (
    <div className="settings-identity">
      <AccountAvatar account={account} className="settings-identity-avatar" />
      <div className="settings-identity-text">
        <strong title={accountDisplayName(account)}>{accountDisplayName(account)}</strong>
        <span>
          {account.uid ? `UID ${account.uid}` : "UID —"} ·{" "}
          {account.loginMethod === "social" ? t.personalAccount : roleLabel(account.role, locale)}
        </span>
      </div>
    </div>
  );
}

/** 左侧栏底部的退出登录。 */
function SettingsLogout() {
  const logout = useEnterpriseLogout();
  const t = useMessages(accountSettingsMessages);
  useErrorToast(logout.error?.message);
  return (
    <Button
      variant="ghost"
      className="settings-sidebar-logout"
      isPending={logout.isPending}
      onPress={() => logout.mutate()}
    >
      <UiIcon icon={IconLogout} />
      {t.logout}
    </Button>
  );
}

/** 按分区 id 选出右侧面板的内容。 */
function SectionContent({
  id,
  account,
  wide,
}: {
  id: SettingsSection;
  account: EnterpriseIdentity;
  wide: boolean;
}) {
  if (id === "plan") return <AccountPlanUsage />;
  if (id === "security") return <AccountPasswordForm />;
  if (id === "automation") return <AccountImageAutomation account={account} />;
  if (id === "members") return <AccountSettingsMembers />;
  // 宽屏的身份与退出登录在左侧栏；手机没有左侧栏，放回账户分区。
  return <AccountSettingsProfile account={account} withIdentity={!wide} />;
}

/**
 * 账户设置：宽屏左侧为身份、分区与退出登录，右侧显示选中的分区；手机改为顶部页签。
 * 充值页叠在账户设置上面，关闭后回到原来的分区。
 */
export function AccountSettingsDialog({
  section,
  onClose,
}: {
  section: SettingsSection;
  onClose: () => void;
}) {
  const account = useEnterpriseSession().data;
  const selectSection = useAccountOverlays((state) => state.selectSection);
  const t = useMessages(accountSettingsMessages);
  const wide = useWideViewport();
  if (!account) return null;
  const sections = settingsSections.filter((id) => {
    if ((id === "security" || id === "automation") && account.loginMethod === "social")
      return false;
    return id !== "members" || account.role === "admin";
  });
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
                selectedKey={sections.includes(section) ? section : "account"}
                onSelectionChange={(key) => {
                  const next = sections.find((id) => id === key);
                  if (next) selectSection(next);
                }}
                orientation={wide ? "vertical" : "horizontal"}
                className="account-center-tabs settings-tabs"
              >
                <div className="settings-sidebar">
                  {wide && <SettingsIdentity account={account} />}
                  <Tabs.ListContainer>
                    <Tabs.List aria-label={t.title}>
                      {sections.map((id) => (
                        <Tabs.Tab key={id} id={id}>
                          <UiIcon icon={sectionIcons[id]} />
                          {t.sections[id]}
                          <Tabs.Indicator />
                        </Tabs.Tab>
                      ))}
                    </Tabs.List>
                  </Tabs.ListContainer>
                  {wide && <SettingsLogout />}
                </div>
                {sections.map((id) => (
                  <Tabs.Panel key={id} id={id}>
                    {wide && <h2 className="settings-panel-title">{t.sections[id]}</h2>}
                    <SectionContent id={id} account={account} wide={wide} />
                  </Tabs.Panel>
                ))}
              </Tabs>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

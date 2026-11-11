import { Button, Chip } from "@heroui/react";
import type { EnterpriseIdentity } from "@lycoboai/contracts";
import { IconCopy, IconLogout, IconUsersGroup } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { copyToClipboard } from "../../../lib/clipboard";
import { useErrorToast } from "../../../lib/error-toast";
import { useEnterpriseLogout } from "../../auth/auth-client";
import { roleLabel } from "../account-format";
import { AccountAvatar } from "../avatar/account-avatar";
import { AvatarPresetPicker } from "./account-avatar-picker";
import { AccountLanguagePicker } from "./account-language-picker";
import { accountSettingsMessages } from "./account-settings-messages";
import { SettingsGroup, SettingsRow } from "./account-settings-rows";

/** 个人资料面板顶部的大号身份信息。 */
function ProfileHero({ account, role }: { account: EnterpriseIdentity; role: string }) {
  const t = useMessages(accountSettingsMessages);
  return (
    <section className="settings-hero" aria-label={t.accountInfo}>
      <AccountAvatar account={account} className="settings-hero-avatar" />
      <div className="settings-hero-main">
        <strong title={account.account}>{account.account}</strong>
        <div className="settings-hero-meta">
          <Chip size="sm" className="account-chip">
            {role}
          </Chip>
          <span>{account.uid ? `UID ${account.uid}` : "UID —"}</span>
        </div>
      </div>
    </section>
  );
}

/**
 * 账户分区：基本资料（头像只能选预设）与企业身份。
 * 手机没有左侧栏，withIdentity 时在顶部显示身份、底部放退出登录。
 */
export function AccountSettingsProfile({
  account,
  withIdentity,
}: {
  account: EnterpriseIdentity;
  withIdentity: boolean;
}) {
  const logout = useEnterpriseLogout();
  const t = useMessages(accountSettingsMessages);
  const role = t.enterpriseRole(roleLabel(account.role, useLocale()));
  useErrorToast(logout.error?.message);
  const uid = account.uid;
  return (
    <div className="account-settings-section">
      {withIdentity && <ProfileHero account={account} role={role} />}
      <SettingsGroup title={t.basicInfo}>
        <SettingsRow label={t.avatar} hint={t.avatarHint}>
          <AvatarPresetPicker account={account} />
        </SettingsRow>
        <SettingsRow label={t.loginAccount} value={account.account} />
        <SettingsRow
          label="UID"
          value={uid ?? "—"}
          action={
            uid && (
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label={t.copyUid}
                className="settings-row-icon"
                onPress={() => void copyToClipboard(uid, t.uidCopied)}
              >
                <UiIcon icon={IconCopy} size="small" />
              </Button>
            )
          }
        />
      </SettingsGroup>
      <SettingsGroup title={t.preferences}>
        <SettingsRow label={t.language} action={<AccountLanguagePicker account={account} />} />
      </SettingsGroup>
      <SettingsGroup title={t.enterpriseIdentity}>
        <SettingsRow label={t.identity} value={role} />
        <SettingsRow label={t.loginMethod} value={t.enterpriseLogin} />
      </SettingsGroup>
      {withIdentity && (
        <div className="settings-footer">
          <Button
            size="sm"
            variant="secondary"
            className="account-settings-logout"
            isPending={logout.isPending}
            onPress={() => logout.mutate()}
          >
            <UiIcon icon={IconLogout} size="small" />
            {t.logout}
          </Button>
        </div>
      )}
    </div>
  );
}

/** 企业成员面板：成员管理尚未开放，只说明用途。 */
export function AccountSettingsMembers() {
  const t = useMessages(accountSettingsMessages);
  return (
    <div className="account-settings-section">
      <SettingsGroup
        title={t.members}
        description={t.membersDescription}
        action={
          <Button size="sm" variant="secondary" isDisabled>
            {t.addMember}
          </Button>
        }
      >
        <div className="settings-empty">
          <span className="settings-empty-mark" aria-hidden="true">
            <UiIcon icon={IconUsersGroup} size="action" />
          </span>
          <strong>{t.membersUnavailable}</strong>
          <p>{t.membersLater}</p>
        </div>
      </SettingsGroup>
    </div>
  );
}

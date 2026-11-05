import { Avatar, Button, Chip } from "@heroui/react";
import type { EnterpriseIdentity } from "@lycoboai/contracts";
import { IconCopy, IconLogout, IconUsersGroup } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import { copyToClipboard } from "../../lib/clipboard";
import { useErrorToast } from "../../lib/error-toast";
import { useEnterpriseLogout } from "../auth/auth-client";
import { roleLabel } from "./account-format";
import { SettingsGroup, SettingsRow } from "./account-settings-rows";

/** Large identity header at the top of the profile panel. */
function ProfileHero({ account }: { account: EnterpriseIdentity }) {
  const initial = Array.from(account.account)[0]?.toUpperCase() ?? "";
  return (
    <section className="settings-hero" aria-label="账号信息">
      <Avatar className="settings-hero-avatar" aria-hidden="true">
        <Avatar.Fallback>{initial}</Avatar.Fallback>
      </Avatar>
      <div className="settings-hero-main">
        <strong title={account.account}>{account.account}</strong>
        <div className="settings-hero-meta">
          <Chip size="sm" className="account-chip">
            企业{roleLabel(account.role)}
          </Chip>
          <span>{account.uid ? `UID ${account.uid}` : "UID —"}</span>
        </div>
      </div>
    </section>
  );
}

export function AccountSettingsProfile({ account }: { account: EnterpriseIdentity }) {
  const logout = useEnterpriseLogout();
  useErrorToast(logout.error?.message);
  const uid = account.uid;
  return (
    <div className="account-settings-section">
      <ProfileHero account={account} />
      <SettingsGroup title="基本资料">
        <SettingsRow
          label="头像"
          hint="头像上传暂未开放"
          action={
            <Button size="sm" variant="secondary" isDisabled>
              上传头像
            </Button>
          }
        />
        <SettingsRow label="登录账号" value={account.account} />
        <SettingsRow
          label="UID"
          value={uid ?? "—"}
          action={
            uid && (
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label="复制 UID"
                className="settings-row-icon"
                onPress={() => void copyToClipboard(uid, "UID 已复制")}
              >
                <UiIcon icon={IconCopy} size="small" />
              </Button>
            )
          }
        />
      </SettingsGroup>
      <SettingsGroup title="企业身份">
        <SettingsRow label="身份" value={`企业${roleLabel(account.role)}`} />
        <SettingsRow label="登录方式" value="企业账号登录" />
      </SettingsGroup>
      <div className="settings-footer">
        <Button
          size="sm"
          variant="secondary"
          className="account-settings-logout"
          isPending={logout.isPending}
          onPress={() => logout.mutate()}
        >
          <UiIcon icon={IconLogout} size="small" />
          退出登录
        </Button>
      </div>
    </div>
  );
}

export function AccountSettingsMembers() {
  return (
    <div className="account-settings-section">
      <SettingsGroup
        title="企业成员"
        description="管理员可为企业添加成员，成员共用企业积分。"
        action={
          <Button size="sm" variant="secondary" isDisabled>
            添加子账号
          </Button>
        }
      >
        <div className="settings-empty">
          <span className="settings-empty-mark" aria-hidden="true">
            <UiIcon icon={IconUsersGroup} size="action" />
          </span>
          <strong>成员管理暂未开放</strong>
          <p>开放后可在这里添加成员并查看成员列表。</p>
        </div>
      </SettingsGroup>
    </div>
  );
}

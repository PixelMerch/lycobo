import { Button } from "@heroui/react";
import type { EnterpriseIdentity } from "@lycoboai/contracts";
import { useErrorToast } from "../../lib/error-toast";
import { useEnterpriseLogout } from "../auth/auth-client";
import { AccountProfile } from "./account-profile";

export function AccountSettingsProfile({ account }: { account: EnterpriseIdentity }) {
  const logout = useEnterpriseLogout();
  useErrorToast(logout.error?.message);
  return (
    <div className="account-settings-section">
      <AccountProfile account={account} />
      <section className="account-setting-row" aria-label="头像">
        <div>
          <h3>头像</h3>
          <p>头像上传暂未开放</p>
        </div>
        <Button size="sm" variant="secondary" isDisabled>
          上传头像
        </Button>
      </section>
      <section className="account-setting-row" aria-label="登录方式">
        <div>
          <h3>登录方式</h3>
          <p>企业账号登录</p>
        </div>
      </section>
      <Button
        size="sm"
        variant="secondary"
        className="account-settings-logout"
        isPending={logout.isPending}
        onPress={() => logout.mutate()}
      >
        退出登录
      </Button>
    </div>
  );
}

export function AccountSettingsMembers() {
  return (
    <section className="account-setting-row" aria-label="企业子账号">
      <div>
        <h3>企业子账号</h3>
        <p>企业成员管理暂未开放。</p>
      </div>
      <Button size="sm" variant="secondary" isDisabled>
        添加子账号
      </Button>
    </section>
  );
}

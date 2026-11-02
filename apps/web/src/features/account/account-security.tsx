import { Button } from "@heroui/react";
import { IconLogout } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import { useErrorToast } from "../../lib/error-toast";
import { useEnterpriseLogout, useEnterpriseSession } from "../auth/auth-client";
import { roleLabel } from "./account-format";
import { AccountManagement } from "./account-management";

export function AccountSecurity() {
  const session = useEnterpriseSession();
  const logout = useEnterpriseLogout();
  useErrorToast(logout.error?.message);
  const account = session.data;
  return (
    <div className="account-security">
      <section className="account-card" aria-labelledby="account-info-heading">
        <h2 id="account-info-heading" className="account-card-title">
          账号信息
        </h2>
        <dl className="account-info-rows">
          <div>
            <dt>企业账号</dt>
            <dd>{account?.account ?? "—"}</dd>
          </div>
          <div>
            <dt>UID</dt>
            <dd>{account?.uid ?? "—"}</dd>
          </div>
          <div>
            <dt>角色</dt>
            <dd>{account ? roleLabel(account.role) : "—"}</dd>
          </div>
          <div>
            <dt>登录方式</dt>
            <dd>企业账号</dd>
          </div>
        </dl>
        <p className="account-note">
          登录用于保存创作记录与素材归属，不会把密码或凭证写入浏览器存储。
        </p>
      </section>
      <section className="account-card" aria-labelledby="account-settings-heading">
        <h2 id="account-settings-heading" className="account-card-title">
          安全设置
        </h2>
        <AccountManagement account={account} />
      </section>
      <div className="account-security-actions">
        <Button variant="secondary" isPending={logout.isPending} onPress={() => logout.mutate()}>
          <UiIcon icon={IconLogout} size="small" />
          退出登录
        </Button>
      </div>
    </div>
  );
}

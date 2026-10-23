import { Avatar, Button, Modal } from "@heroui/react";
import { IconLogout, IconX } from "@tabler/icons-react";
import { useErrorToast } from "../../lib/error-toast";
import { AccountManagement } from "./account-management";
import "./account-panel.css";
import { UiIcon } from "../../components/ui-icon";
import { useEnterpriseLogout, useEnterpriseSession } from "../auth/auth-client";
import { WalletPanel } from "./wallet-panel";

export type AccountSection = "profile" | "credits" | "management";
const roleLabels: Record<string, string> = {
  member: "成员",
  admin: "管理员",
  owner: "拥有者",
};
export function AccountPanel({
  section,
  onClose,
}: {
  section: AccountSection;
  onClose: () => void;
}) {
  const session = useEnterpriseSession();
  const logout = useEnterpriseLogout();
  const title = { profile: "个人信息", credits: "订阅与账单", management: "账号管理" }[section];
  const account = session.data;
  useErrorToast(logout.error?.message);
  return (
    <Modal isOpen onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <Modal.Backdrop className="account-backdrop">
        <Modal.Container>
          <Modal.Dialog className={`account-dialog account-dialog--${section}`}>
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
              <Modal.CloseTrigger aria-label={`关闭${title}`}>
                <UiIcon icon={IconX} size="default" />
              </Modal.CloseTrigger>
            </Modal.Header>
            <Modal.Body>
              {section === "profile" && (
                <div className="account-identity">
                  <Avatar className="account-avatar" size="lg">
                    <Avatar.Fallback>
                      {account?.account.slice(0, 1).toUpperCase() ?? "?"}
                    </Avatar.Fallback>
                  </Avatar>
                  <div>
                    <strong>{account?.account ?? "未登录"}</strong>
                    <small>
                      {account ? (roleLabels[account.role] ?? account.role) : "登录后可查看"}
                    </small>
                  </div>
                </div>
              )}
              {section === "profile" && (
                <div className="account-profile">
                  <dl className="account-rows">
                    <div>
                      <dt>账号</dt>
                      <dd>{account?.account ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>角色</dt>
                      <dd>{account ? (roleLabels[account.role] ?? account.role) : "—"}</dd>
                    </div>
                    <div>
                      <dt>登录方式</dt>
                      <dd>企业账号</dd>
                    </div>
                  </dl>
                  <p className="account-note">
                    登录用于保存创作记录与素材归属，不会把密码或凭证写入浏览器存储。
                  </p>
                  <Button
                    variant="secondary"
                    isPending={logout.isPending}
                    onPress={() => logout.mutate()}
                  >
                    <UiIcon icon={IconLogout} size="small" />
                    退出登录
                  </Button>
                </div>
              )}
              {section === "management" && <AccountManagement account={account} />}
              {section === "credits" && <WalletPanel />}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

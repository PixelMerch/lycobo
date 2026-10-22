import { Avatar, Button, Modal, Tabs } from "@heroui/react";
import { IconLogout, IconX } from "@tabler/icons-react";
import { useState } from "react";
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
  const [active, setActive] = useState<AccountSection>(section);
  const account = session.data;
  useErrorToast(logout.error?.message);
  return (
    <Modal isOpen onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className={`account-dialog account-dialog--${active}`}>
            <Modal.Header>
              <Modal.Heading>账户中心</Modal.Heading>
              <Modal.CloseTrigger aria-label="关闭账户中心">
                <UiIcon icon={IconX} size="default" />
              </Modal.CloseTrigger>
            </Modal.Header>
            <Modal.Body>
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
              <Tabs
                selectedKey={active}
                onSelectionChange={(key) => {
                  if (key === "profile" || key === "credits" || key === "management")
                    setActive(key);
                }}
              >
                <Tabs.ListContainer>
                  <Tabs.List aria-label="账户信息">
                    <Tabs.Tab id="profile">
                      个人信息
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab id="credits">
                      订阅与账单
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab id="management">
                      账号管理
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  </Tabs.List>
                </Tabs.ListContainer>
                <Tabs.Panel id="profile">
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
                </Tabs.Panel>
                <Tabs.Panel id="management">
                  <AccountManagement account={account} />
                </Tabs.Panel>
                <Tabs.Panel id="credits">
                  <WalletPanel />
                </Tabs.Panel>
              </Tabs>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

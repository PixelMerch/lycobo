import { Alert, Avatar, Button, Chip, Modal, Tabs } from "@heroui/react";
import { IconLogout, IconSparkles } from "@tabler/icons-react";
import { useState } from "react";
import { UiIcon } from "../../components/ui-icon";
import { useEnterpriseLogout, useEnterpriseSession } from "./auth-client";

export type AccountSection = "profile" | "credits";
const roleLabels: Record<string, string> = {
  member: "成员",
  admin: "管理员",
  owner: "拥有者",
};
/** 方案与价格尚未确认，界面只呈现结构，不虚构额度或金额。 */
const creditPlans = [
  { id: "starter", name: "轻量包", hint: "先试做一组商品图与场景图" },
  { id: "studio", name: "常用包", hint: "日常上新与批量场景制作" },
  { id: "team", name: "团队包", hint: "多人协作与长期素材生产" },
];

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
  return (
    <Modal isOpen onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="account-dialog">
            <Modal.Header>
              <Modal.Heading>账户中心</Modal.Heading>
              <Modal.CloseTrigger aria-label="关闭账户中心" />
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
                onSelectionChange={(key) => setActive(String(key) as AccountSection)}
              >
                <Tabs.ListContainer>
                  <Tabs.List aria-label="账户信息">
                    <Tabs.Tab id="profile">
                      个人信息
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab id="credits">
                      积分与购买
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
                  {logout.isError ? (
                    <Alert className="account-alert" status="danger">
                      <Alert.Content>
                        <Alert.Description>退出失败，请重试。</Alert.Description>
                      </Alert.Content>
                    </Alert>
                  ) : null}
                </Tabs.Panel>
                <Tabs.Panel id="credits">
                  <div className="credit-balance">
                    <div>
                      <small>积分余额</small>
                      <strong>—</strong>
                    </div>
                    <Chip variant="soft" size="sm">
                      尚未开放
                    </Chip>
                  </div>
                  <Alert className="account-alert" status="warning">
                    <Alert.Content>
                      <Alert.Description>
                        积分服务尚未接入，余额、购买与扣费都不生效。接入后这里才会显示真实额度。
                      </Alert.Description>
                    </Alert.Content>
                  </Alert>
                  <div className="credit-plans">
                    {creditPlans.map((plan) => (
                      <div className="credit-plan" key={plan.id}>
                        <span>
                          <strong>{plan.name}</strong>
                          <small>{plan.hint}</small>
                        </span>
                        <span className="credit-plan-price">
                          <strong>— 积分</strong>
                          <small>价格待定</small>
                        </span>
                        <Button variant="outline" size="sm" isDisabled>
                          暂未开放
                        </Button>
                      </div>
                    ))}
                  </div>
                  <p className="account-note">
                    <UiIcon icon={IconSparkles} size="small" />
                    积分接入后，余额与消耗记录会显示在这里。
                  </p>
                </Tabs.Panel>
              </Tabs>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

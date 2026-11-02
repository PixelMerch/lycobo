import { Avatar, Button, Chip, EmptyState, Tabs } from "@heroui/react";
import { IconCopy, IconSettings } from "@tabler/icons-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { UiIcon } from "../../components/ui-icon";
import { copyToClipboard } from "../../lib/clipboard";
import { useEnterpriseSession } from "../auth/auth-client";
import { LoginDialog } from "../auth/login-dialog";
import { accountCenterPath, accountCenterTabs } from "./account-center-tabs";
import { roleLabel } from "./account-format";
import { AccountMembership } from "./account-membership";
import { AccountOverview } from "./account-overview";
import { AccountSecurity } from "./account-security";
import { CreditLedger } from "./credit-ledger";
import { RechargeOrders } from "./recharge-orders";
import "./account-panel.css";
import "./account-center.css";

/** Only the selected tab mounts, so each tab reads (and reports failures for) its own data. */
export function AccountCenterPage() {
  const session = useEnterpriseSession();
  const navigate = useNavigate();
  const { tab = "" } = useParams();
  const [loginOpen, setLoginOpen] = useState(false);
  const active = accountCenterTabs.find((item) => item.path === tab)?.id ?? "overview";
  const account = session.data;
  if (session.isPending) return null;
  if (!account)
    return (
      <EmptyState className="empty-state account-center-signin">
        <h1>登录后查看个人中心</h1>
        <p>个人中心汇总企业共享积分、收支明细与账号设置。</p>
        <Button variant="primary" onPress={() => setLoginOpen(true)}>
          登录
        </Button>
        {loginOpen && <LoginDialog onClose={() => setLoginOpen(false)} />}
      </EmptyState>
    );
  const initial = Array.from(account.account)[0]?.toUpperCase() ?? "";
  return (
    <div className="account-center">
      <h1 className="account-center-title">个人中心</h1>
      <section className="account-profile-card" aria-label="账号信息">
        <Avatar className="account-profile-avatar" aria-hidden="true">
          <Avatar.Fallback>{initial}</Avatar.Fallback>
        </Avatar>
        <div className="account-profile-main">
          <strong title={account.account}>{account.account}</strong>
          <div className="account-profile-meta">
            <Chip size="sm" className="account-chip">
              {roleLabel(account.role)}
            </Chip>
            <span>{account.uid ? `UID ${account.uid}` : "UID —"}</span>
            {account.uid && (
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label="复制 UID"
                className="account-copy"
                onPress={() => {
                  if (account.uid) void copyToClipboard(account.uid, "UID 已复制");
                }}
              >
                <UiIcon icon={IconCopy} size="small" />
              </Button>
            )}
            <span className="account-profile-dot" aria-hidden="true" />
            <span>企业账号登录</span>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="account-profile-action"
          onPress={() => navigate(accountCenterPath("security"))}
        >
          <UiIcon icon={IconSettings} />
          账号与安全
        </Button>
      </section>
      <Tabs
        selectedKey={active}
        onSelectionChange={(key) => {
          const next = accountCenterTabs.find((item) => item.id === key);
          if (next && next.id !== active) navigate(accountCenterPath(next.id));
        }}
        className="account-center-tabs"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="个人中心">
            {accountCenterTabs.map((item) => (
              <Tabs.Tab key={item.id} id={item.id}>
                {item.label}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="overview">
          <AccountOverview />
        </Tabs.Panel>
        <Tabs.Panel id="credits">
          <CreditLedger />
        </Tabs.Panel>
        <Tabs.Panel id="orders">
          <RechargeOrders />
        </Tabs.Panel>
        <Tabs.Panel id="membership">
          <AccountMembership />
        </Tabs.Panel>
        <Tabs.Panel id="security">
          <AccountSecurity />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

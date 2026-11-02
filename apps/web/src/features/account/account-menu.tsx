import { Avatar, Button, Dropdown, Separator } from "@heroui/react";
import { IconLogout, IconPhoto, IconReceipt, IconSettings, IconUser } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { CreditCoin } from "../../components/credit-coin";
import { UiIcon } from "../../components/ui-icon";
import { useErrorToast } from "../../lib/error-toast";
import { useEnterpriseLogout, useEnterpriseSession } from "../auth/auth-client";
import { LoginDialog } from "../auth/login-dialog";
import { AccountPanel, type AccountSection } from "./account-panel";
import { AccountUpdates } from "./account-updates";
import { useWallet } from "./wallet-client";
import "./account-menu.css";

/** Signed out, the header offers login; once signed in the account lives in the navigation. */
export function HeaderLogin() {
  const session = useEnterpriseSession();
  const [loginOpen, setLoginOpen] = useState(false);
  return (
    <>
      {!session.data && (
        <Button
          variant="tertiary"
          size="sm"
          className="header-login"
          onPress={() => setLoginOpen(true)}
        >
          登录领积分
        </Button>
      )}
      {loginOpen && <LoginDialog onClose={() => setLoginOpen(false)} />}
    </>
  );
}

/**
 * The signed-in account sits in a quiet footer row (avatar, name and
 * name) and opens its menu upward; balance is shared with the header entry.
 */
export function AccountMenu({ onNavigate }: { onNavigate?: () => void }) {
  const session = useEnterpriseSession();
  const wallet = useWallet();
  const logout = useEnterpriseLogout();
  const navigate = useNavigate();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [section, setSection] = useState<AccountSection | null>(null);
  const restoreFocus = useRef(false);
  useErrorToast(logout.error?.message);
  // Closing the account center returns focus to the account row that opened it.
  useEffect(() => {
    if (section !== null || !restoreFocus.current) return;
    restoreFocus.current = false;
    triggerRef.current?.focus({ preventScroll: true });
  }, [section]);
  const account = session.data;
  if (!account) return null;
  const characters = Array.from(account.account);
  const nickname = account.account;
  const initial = characters[0]?.toUpperCase() ?? "";
  const balance = wallet.data?.balance ?? "—";
  return (
    <div className="account-footer">
      <Dropdown>
        <Dropdown.Trigger
          ref={triggerRef}
          className="account-trigger"
          aria-label={`账户菜单：${account.account}`}
        >
          <Avatar className="account-avatar" size="sm" aria-hidden="true">
            <Avatar.Fallback>{initial}</Avatar.Fallback>
          </Avatar>
          <span className="account-trigger-name" title={account.account} aria-hidden="true">
            {nickname}
          </span>
        </Dropdown.Trigger>
        <Dropdown.Popover
          className="account-menu"
          placement="top start"
          offset={8}
          isNonModal={false}
        >
          <div className="account-menu-identity">
            <Avatar size="lg" className="account-menu-avatar" aria-hidden="true">
              <Avatar.Fallback>{initial}</Avatar.Fallback>
            </Avatar>
            <div className="account-menu-details">
              <strong className="account-menu-name" title={account.account}>
                {account.account}
              </strong>
              <span>{account.uid ? `UID ${account.uid}` : "UID —"}</span>
            </div>
          </div>
          <div className="account-menu-balance">
            <span>企业共享积分</span>
            <span className="account-credits">
              <CreditCoin size="default" />
              <strong>{balance}</strong>
            </span>
          </div>
          <Dropdown.Menu
            disabledKeys={logout.isPending ? ["logout"] : []}
            onAction={(key) => {
              if (key === "works") {
                onNavigate?.();
                navigate("/assets");
              } else if (key === "profile" || key === "credits" || key === "management")
                setSection(key);
              else if (key === "logout") logout.mutate();
            }}
          >
            <Dropdown.Section aria-label="个人空间">
              <Dropdown.Item id="works" textValue="个人作品">
                <UiIcon icon={IconPhoto} />
                <span>个人作品</span>
              </Dropdown.Item>
              <Dropdown.Item id="profile" textValue="个人信息">
                <UiIcon icon={IconUser} />
                <span>个人信息</span>
              </Dropdown.Item>
              <Dropdown.Item id="credits" textValue="订阅与账单">
                <UiIcon icon={IconReceipt} />
                <span>订阅与账单</span>
              </Dropdown.Item>
            </Dropdown.Section>
            <Separator className="account-menu-separator" />
            <Dropdown.Section aria-label="账号操作">
              <Dropdown.Item id="management" textValue="账号管理">
                <UiIcon icon={IconSettings} />
                <span>账号管理</span>
              </Dropdown.Item>
              <Dropdown.Item id="logout" textValue="退出登录">
                <UiIcon icon={IconLogout} />
                <span>{logout.isPending ? "正在退出…" : "退出登录"}</span>
              </Dropdown.Item>
            </Dropdown.Section>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      <div className="account-footer-tools">
        <AccountUpdates kind="updates" />
        <AccountUpdates kind="messages" />
      </div>
      {section && (
        <AccountPanel
          key={section}
          section={section}
          onClose={() => {
            restoreFocus.current = true;
            setSection(null);
          }}
        />
      )}
    </div>
  );
}

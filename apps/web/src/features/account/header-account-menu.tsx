import { Avatar, Button, Dropdown, Separator } from "@heroui/react";
import { IconLogout, IconPhoto, IconReceipt, IconSettings, IconUser } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { CreditCoin } from "../../components/credit-coin";
import { UiIcon } from "../../components/ui-icon";
import { useHoverMenu } from "../../components/use-hover-menu";
import { useErrorToast } from "../../lib/error-toast";
import { useEnterpriseLogout, useEnterpriseSession } from "../auth/auth-client";
import { LoginDialog } from "../auth/login-dialog";
import { AccountPanel, type AccountSection } from "./account-panel";
import { useWallet } from "./wallet-client";
import "./header-account-menu.css";

/** One account entry owns authentication, its menu and account destinations. */
export function HeaderAccountMenu() {
  const session = useEnterpriseSession();
  const wallet = useWallet();
  const logout = useEnterpriseLogout();
  const navigate = useNavigate();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menu = useHoverMenu(triggerRef, ".header-account-menu [role='menuitem']");
  const [loginOpen, setLoginOpen] = useState(false);
  const [section, setSection] = useState<AccountSection | null>(null);
  const restoreFocus = useRef(false);
  useErrorToast(logout.error?.message);
  // Closing the account center returns focus to the capsule that opened it; the
  // non-modal menu no longer restores focus on its own.
  useEffect(() => {
    if (section !== null || !restoreFocus.current) return;
    restoreFocus.current = false;
    triggerRef.current?.focus({ preventScroll: true });
  }, [section]);
  const account = session.data;
  const initial = account?.account.slice(0, 1).toUpperCase();
  const balance = wallet.data?.balance ?? "—";
  return (
    <>
      {account ? (
        <Dropdown isOpen={menu.isOpen} onOpenChange={menu.onOpenChange}>
          <Dropdown.Trigger
            ref={triggerRef}
            className="account-trigger"
            aria-label={`账户菜单：${account.account}`}
            aria-description={`积分余额 ${balance}`}
            {...menu.triggerProps}
          >
            <span className="header-account-credits" aria-hidden="true">
              <CreditCoin size="navigation" />
              <strong>{balance}</strong>
            </span>
            <Avatar className="header-account-avatar" size="sm" aria-hidden="true">
              <Avatar.Fallback>{initial}</Avatar.Fallback>
            </Avatar>
          </Dropdown.Trigger>
          <Dropdown.Popover
            className="header-account-menu"
            placement="bottom end"
            isNonModal
            {...menu.popoverProps}
          >
            <div className="header-account-identity">
              <Avatar size="lg" className="header-account-profile-avatar" aria-hidden="true">
                <Avatar.Fallback>{initial}</Avatar.Fallback>
              </Avatar>
              <div className="header-account-details">
                <strong className="header-account-name" title={account.account}>
                  {account.account}
                </strong>
                <span>{account.uid ? `账号 ${account.uid}` : "企业账号"}</span>
              </div>
            </div>
            <div className="header-account-balance">
              <span>企业共享积分</span>
              <span className="header-account-credits">
                <CreditCoin size="default" />
                <strong>{balance}</strong>
              </span>
            </div>
            <Dropdown.Menu
              autoFocus={false}
              disabledKeys={logout.isPending ? ["logout"] : []}
              onAction={(key) => {
                if (key === "works") navigate("/assets");
                else if (key === "profile" || key === "credits" || key === "management")
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
              <Separator className="header-account-separator" />
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
      ) : (
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
    </>
  );
}

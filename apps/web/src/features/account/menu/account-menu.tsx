import { Avatar, Button, Dropdown, Separator } from "@heroui/react";
import { IconLogout, IconPhoto, IconSettings } from "@tabler/icons-react";
import { useRef } from "react";
import { useNavigate } from "react-router";
import { UiIcon } from "../../../components/ui-icon";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { useErrorToast } from "../../../lib/error-toast";
import { useEnterpriseLogout, useEnterpriseSession } from "../../auth/auth-client";
import { useOpenLogin } from "../../auth/login-prompt";
import { roleLabel } from "../account-format";
import { useAccountOverlays } from "../account-overlay-store";
import { AccountMessages } from "../notifications/account-messages";
import { accountMenuMessages } from "./account-menu-messages";
import "../account-common.css";
import "./account-menu.css";

/** 未登录入口前往独立登录页；登录后桌面账户在顶部栏右侧，手机在导航抽屉底部。 */
export function HeaderLogin() {
  const session = useEnterpriseSession();
  const openLogin = useOpenLogin();
  const t = useMessages(accountMenuMessages);
  return (
    <>
      {!session.data && (
        <Button variant="tertiary" size="sm" className="header-login" onPress={openLogin}>
          {t.login}
        </Button>
      )}
    </>
  );
}

/**
 * 账户菜单只保留身份、设置、个人作品与退出登录；会员、积分与账单都在账户设置里。
 * 桌面顶部栏只显示头像并向下展开；手机导航抽屉底部显示头像、昵称及消息，向上展开。
 */
export function AccountMenu({
  onNavigate,
  variant = "footer",
}: {
  onNavigate?: () => void;
  variant?: "header" | "footer";
}) {
  const session = useEnterpriseSession();
  const logout = useEnterpriseLogout();
  const navigate = useNavigate();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openSettings = useAccountOverlays((state) => state.openSettings);
  const t = useMessages(accountMenuMessages);
  const locale = useLocale();
  useErrorToast(logout.error?.message);
  const account = session.data;
  if (!account) return null;
  const initial = Array.from(account.account)[0]?.toUpperCase() ?? "";
  const go = (path: string) => {
    onNavigate?.();
    void navigate(path);
  };
  const inHeader = variant === "header";
  return (
    <div className={inHeader ? "account-header" : "account-footer"}>
      <Dropdown>
        <Dropdown.Trigger
          ref={triggerRef}
          className="account-trigger"
          aria-label={t.accountMenu(account.account)}
        >
          <Avatar className="account-avatar" size="sm" aria-hidden="true">
            <Avatar.Fallback>{initial}</Avatar.Fallback>
          </Avatar>
          {!inHeader && (
            <span className="account-trigger-name" title={account.account} aria-hidden="true">
              {account.account}
            </span>
          )}
        </Dropdown.Trigger>
        <Dropdown.Popover
          className="account-menu"
          placement={inHeader ? "bottom end" : "top start"}
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
              <span>
                {account.uid ? `UID ${account.uid}` : "UID —"} · {roleLabel(account.role, locale)}
              </span>
            </div>
          </div>
          <Dropdown.Menu
            disabledKeys={logout.isPending ? ["logout"] : []}
            onAction={(key) => {
              // 账户设置叠在手机导航抽屉之上，关闭后焦点回到头像入口。
              if (key === "settings") openSettings("account", triggerRef.current);
              else if (key === "works") go("/assets");
              else if (key === "logout") logout.mutate();
            }}
          >
            <Dropdown.Section aria-label={t.personalSpace}>
              <Dropdown.Item id="settings" textValue={t.settings}>
                <UiIcon icon={IconSettings} />
                <span>{t.settings}</span>
              </Dropdown.Item>
              <Dropdown.Item id="works" textValue={t.works}>
                <UiIcon icon={IconPhoto} />
                <span>{t.works}</span>
              </Dropdown.Item>
            </Dropdown.Section>
            <Separator className="account-menu-separator" />
            <Dropdown.Section aria-label={t.accountActions}>
              <Dropdown.Item id="logout" textValue={t.logout}>
                <UiIcon icon={IconLogout} />
                <span>{logout.isPending ? t.loggingOut : t.logout}</span>
              </Dropdown.Item>
            </Dropdown.Section>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      {!inHeader && (
        <div className="account-footer-tools">
          <AccountMessages />
        </div>
      )}
    </div>
  );
}

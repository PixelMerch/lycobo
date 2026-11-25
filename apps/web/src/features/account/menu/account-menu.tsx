import { Button, Popover, Separator } from "@heroui/react";
import { IconLogout, IconPhoto, IconSettings } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { useErrorToast } from "../../../lib/error-toast";
import { useOpenAssetLibrary } from "../../assets/asset-library-store";
import { useEnterpriseLogout, useEnterpriseSession } from "../../auth/auth-client";
import { useOpenLogin } from "../../auth/login-prompt";
import { accountDisplayName, roleLabel } from "../account-format";
import { useAccountOverlays } from "../account-overlay-store";
import { AccountAvatar } from "../avatar/account-avatar";
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
 * 点击头像或使用键盘打开账户菜单，进入设置、个人作品或退出登录。
 * 桌面顶部栏只显示头像并向下展开；手机导航抽屉底部显示头像和昵称，向上展开。
 */
export function AccountMenu({
  onNavigate,
  popoverClassName,
  popoverOffset = 8,
  variant = "footer",
}: {
  onNavigate?: () => void;
  popoverClassName?: string;
  popoverOffset?: number;
  variant?: "header" | "footer";
}) {
  const session = useEnterpriseSession();
  const logout = useEnterpriseLogout();
  const [isOpen, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openSettings = useAccountOverlays((state) => state.openSettings);
  const openLibrary = useOpenAssetLibrary();
  const t = useMessages(accountMenuMessages);
  const locale = useLocale();
  useErrorToast(logout.error?.message);
  const account = session.data;
  if (!account) return null;
  // 个人作品就是素材库弹窗；手机上先收起导航抽屉，关闭后焦点回到头像入口。
  const openWorks = () => {
    onNavigate?.();
    openLibrary(triggerRef.current);
  };
  const inHeader = variant === "header";
  return (
    <div
      className={inHeader ? "account-header" : "account-footer"}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape" && isOpen) setOpen(false);
        // 面板展开时，回车只关闭面板，避免直接执行获得焦点的操作。
        if (!isOpen || event.key !== "Enter" || event.nativeEvent.isComposing) return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }}
    >
      <Popover isOpen={isOpen} onOpenChange={setOpen}>
        <Button
          size="sm"
          variant="ghost"
          ref={triggerRef}
          className="account-trigger"
          aria-label={t.accountMenu(accountDisplayName(account))}
        >
          <AccountAvatar account={account} size="sm" className="account-avatar" />
          {!inHeader && (
            <span
              className="account-trigger-name"
              title={accountDisplayName(account)}
              aria-hidden="true"
            >
              {accountDisplayName(account)}
            </span>
          )}
        </Button>
        <Popover.Content
          className={`account-menu${popoverClassName ? ` ${popoverClassName}` : ""}`}
          placement={inHeader ? "bottom end" : "top start"}
          offset={popoverOffset}
          aria-label={t.accountMenu(accountDisplayName(account))}
        >
          <div className="account-menu-identity">
            <AccountAvatar account={account} size="lg" className="account-menu-avatar" />
            <div className="account-menu-details">
              <strong className="account-menu-name" title={accountDisplayName(account)}>
                {accountDisplayName(account)}
              </strong>
              <span>
                {account.uid ? `UID ${account.uid}` : "UID —"} · {roleLabel(account.role, locale)}
              </span>
            </div>
          </div>
          <Button
            className="account-menu-row"
            size="sm"
            variant="ghost"
            autoFocus
            onPress={() => {
              setOpen(false);
              openSettings("account", triggerRef.current);
            }}
          >
            <UiIcon icon={IconSettings} />
            {t.settings}
          </Button>
          <Button
            className="account-menu-row"
            size="sm"
            variant="ghost"
            onPress={() => {
              setOpen(false);
              openWorks();
            }}
          >
            <UiIcon icon={IconPhoto} />
            {t.works}
          </Button>
          <Separator className="account-menu-separator" />
          <Button
            className="account-menu-row"
            size="sm"
            variant="ghost"
            isDisabled={logout.isPending}
            onPress={() => {
              setOpen(false);
              logout.mutate();
            }}
          >
            <UiIcon icon={IconLogout} />
            {logout.isPending ? t.loggingOut : t.logout}
          </Button>
        </Popover.Content>
      </Popover>
    </div>
  );
}

import { Button, Popover, Separator } from "@heroui/react";
import { IconLogout, IconPhoto, IconSettings } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { useErrorToast } from "../../../lib/error-toast";
import { useHoverMenu } from "../../../lib/use-hover-menu";
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
 * 账户菜单提供设置、个人作品与退出登录。
 * 桌面顶部栏只显示头像并向下展开；手机导航抽屉底部显示头像和昵称，向上展开。
 */
export function AccountMenu({
  onNavigate,
  hover = false,
  popoverClassName,
  popoverOffset = 8,
  variant = "footer",
}: {
  onNavigate?: () => void;
  hover?: boolean;
  popoverClassName?: string;
  popoverOffset?: number;
  variant?: "header" | "footer";
}) {
  const session = useEnterpriseSession();
  const logout = useEnterpriseLogout();
  const menu = useHoverMenu();
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
    openLibrary(menu.triggerRef.current);
  };
  const inHeader = variant === "header";
  return (
    <div
      className={inHeader ? "account-header" : "account-footer"}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape" && menu.isOpen) menu.close();
        // 面板展开时，回车只关闭面板，避免直接执行获得焦点的操作。
        if (!menu.isOpen || event.key !== "Enter" || event.nativeEvent.isComposing) return;
        event.preventDefault();
        event.stopPropagation();
        menu.close();
      }}
    >
      <Popover isOpen={menu.isOpen} onOpenChange={menu.onOpenChange}>
        <Button
          size="sm"
          variant="ghost"
          ref={menu.triggerRef}
          className="account-trigger"
          aria-label={t.accountMenu(accountDisplayName(account))}
          onPointerEnter={(event) => {
            if (hover && event.pointerType === "mouse") menu.openOnHover();
          }}
          onPointerLeave={(event) => {
            if (hover && event.pointerType === "mouse") menu.closeSoon();
          }}
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
          ref={menu.popoverRef}
          className={`account-menu${popoverClassName ? ` ${popoverClassName}` : ""}`}
          placement={inHeader ? "bottom end" : "top start"}
          offset={popoverOffset}
          aria-label={t.accountMenu(accountDisplayName(account))}
          isNonModal={hover}
          onPointerEnter={hover ? menu.cancelClose : undefined}
          onPointerLeave={hover ? menu.closeSoon : undefined}
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
            autoFocus={!menu.openedByHover}
            onPress={() => {
              menu.close();
              openSettings("account", menu.triggerRef.current);
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
              menu.close();
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
              menu.close();
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

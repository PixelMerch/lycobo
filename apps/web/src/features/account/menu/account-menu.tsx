import { Avatar, Button, Chip, Dropdown, Separator } from "@heroui/react";
import { imageUnitCredits } from "@lycoboai/contracts";
import {
  IconChevronRight,
  IconCrown,
  IconLogout,
  IconPhoto,
  IconShieldLock,
  IconUserCircle,
} from "@tabler/icons-react";
import { useRef } from "react";
import { useNavigate } from "react-router";
import { CreditCoin } from "../../../components/credit-coin";
import { UiIcon } from "../../../components/ui-icon";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { useErrorToast } from "../../../lib/error-toast";
import { useEnterpriseLogout, useEnterpriseSession } from "../../auth/auth-client";
import { useOpenLogin } from "../../auth/login-prompt";
import { formatCredits, imagesFor, roleLabel } from "../account-format";
import { useAccountOverlays } from "../account-overlay-store";
import { AccountMessages } from "../notifications/account-messages";
import { useWallet } from "../wallet-client";
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
 * 账户菜单是账户中心的快捷入口：共享积分、会员状态与常用操作。桌面顶部栏只显示头像并向下展开；
 * 手机导航抽屉底部显示头像、昵称及更新与消息，向上展开。
 */
export function AccountMenu({
  onNavigate,
  variant = "footer",
}: {
  onNavigate?: () => void;
  variant?: "header" | "footer";
}) {
  const session = useEnterpriseSession();
  const wallet = useWallet();
  const logout = useEnterpriseLogout();
  const navigate = useNavigate();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openOverlay = useAccountOverlays((state) => state.open);
  const openCenter = useAccountOverlays((state) => state.openCenter);
  const t = useMessages(accountMenuMessages);
  const locale = useLocale();
  useErrorToast(logout.error?.message);
  const account = session.data;
  if (!account) return null;
  const initial = Array.from(account.account)[0]?.toUpperCase() ?? "";
  const unit = wallet.data?.unitCredits ?? imageUnitCredits;
  const balance = wallet.data?.balance;
  const go = (path: string) => {
    onNavigate?.();
    void navigate(path);
  };
  // 账户中心及其弹窗叠在手机导航抽屉之上，关闭后焦点能回到这个入口。
  const open = (overlay: "recharge" | "membership") => openOverlay(overlay, triggerRef.current);
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
          <div className="account-menu-balance">
            <div className="account-menu-balance-row">
              <span>
                <CreditCoin size="default" />
                {t.sharedCredits}
              </span>
              <strong className="account-credits">
                {balance === undefined ? "—" : formatCredits(balance)}
              </strong>
            </div>
            <small>
              {t.perImage(unit)}
              {balance === undefined ? "" : t.imagesLeft(formatCredits(imagesFor(balance, unit)))}
            </small>
          </div>
          <Dropdown.Menu
            disabledKeys={logout.isPending ? ["logout"] : []}
            onAction={(key) => {
              if (key === "recharge" || key === "membership") open(key);
              // “积分明细”与顶部栏积分菜单打开同一个明细弹窗；完整账单在“积分与账单”。
              else if (key === "ledger") openOverlay("usage", triggerRef.current);
              else if (key === "center") openCenter("credits", triggerRef.current);
              else if (key === "works") go("/assets");
              else if (key === "settings") openOverlay("settings", triggerRef.current);
              else if (key === "logout") logout.mutate();
            }}
          >
            <Dropdown.Section aria-label={t.credits} className="account-menu-quick">
              <Dropdown.Item
                id="recharge"
                textValue={t.recharge}
                className="account-menu-pill account-menu-pill--primary"
              >
                {t.recharge}
              </Dropdown.Item>
              <Dropdown.Item id="ledger" textValue={t.usage} className="account-menu-pill">
                {t.usage}
              </Dropdown.Item>
            </Dropdown.Section>
            <Dropdown.Section aria-label={t.membership} className="account-menu-membership">
              <Dropdown.Item
                id="membership"
                textValue={t.membershipText}
                className="account-menu-member"
              >
                <UiIcon icon={IconCrown} className="account-menu-crown" />
                <span>{t.membership}</span>
                <Chip size="sm" className="account-chip">
                  {t.notMember}
                </Chip>
                <span className="account-menu-member-link">
                  {t.viewPlans}
                  <UiIcon icon={IconChevronRight} size="small" />
                </span>
              </Dropdown.Item>
            </Dropdown.Section>
            <Dropdown.Section aria-label={t.personalSpace}>
              <Dropdown.Item id="center" textValue={t.creditsAndBilling}>
                <UiIcon icon={IconUserCircle} />
                <span>{t.creditsAndBilling}</span>
              </Dropdown.Item>
              <Dropdown.Item id="works" textValue={t.works}>
                <UiIcon icon={IconPhoto} />
                <span>{t.works}</span>
              </Dropdown.Item>
            </Dropdown.Section>
            <Separator className="account-menu-separator" />
            <Dropdown.Section aria-label={t.accountActions}>
              <Dropdown.Item id="settings" textValue={t.settings}>
                <UiIcon icon={IconShieldLock} />
                <span>{t.settings}</span>
              </Dropdown.Item>
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

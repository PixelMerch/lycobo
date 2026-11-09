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
import { useErrorToast } from "../../../lib/error-toast";
import { useEnterpriseLogout, useEnterpriseSession } from "../../auth/auth-client";
import { useOpenLogin } from "../../auth/login-prompt";
import { formatCredits, imagesFor, roleLabel } from "../account-format";
import { useAccountOverlays } from "../account-overlay-store";
import { AccountUpdates } from "../notifications/account-updates";
import { useWallet } from "../wallet-client";
import "../account-common.css";
import "./account-menu.css";

/** 未登录入口前往独立登录页，已登录账户仍保留在侧栏。 */
export function HeaderLogin() {
  const session = useEnterpriseSession();
  const openLogin = useOpenLogin();
  return (
    <>
      {!session.data && (
        <Button variant="tertiary" size="sm" className="header-login" onPress={openLogin}>
          登录领积分
        </Button>
      )}
    </>
  );
}

/**
 * The signed-in account sits in a quiet footer row and opens its menu upward. The menu is the
 * shortcut into the account center: shared credits, membership status and the common actions.
 */
export function AccountMenu({ onNavigate }: { onNavigate?: () => void }) {
  const session = useEnterpriseSession();
  const wallet = useWallet();
  const logout = useEnterpriseLogout();
  const navigate = useNavigate();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openOverlay = useAccountOverlays((state) => state.open);
  const openCenter = useAccountOverlays((state) => state.openCenter);
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
  // The account center and its dialogs stack above the phone navigation drawer, so focus can
  // return to this row.
  const open = (overlay: "recharge" | "membership") => openOverlay(overlay, triggerRef.current);
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
            {account.account}
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
              <span>
                {account.uid ? `UID ${account.uid}` : "UID —"} · {roleLabel(account.role)}
              </span>
            </div>
          </div>
          <div className="account-menu-balance">
            <div className="account-menu-balance-row">
              <span>
                <CreditCoin size="default" />
                企业共享积分
              </span>
              <strong className="account-credits">
                {balance === undefined ? "—" : formatCredits(balance)}
              </strong>
            </div>
            <small>
              每张 {unit} 积分
              {balance === undefined
                ? ""
                : ` · 约可生成 ${formatCredits(imagesFor(balance, unit))} 张`}
            </small>
          </div>
          <Dropdown.Menu
            disabledKeys={logout.isPending ? ["logout"] : []}
            onAction={(key) => {
              if (key === "recharge" || key === "membership") open(key);
              else if (key === "ledger") openCenter("credits", triggerRef.current);
              else if (key === "center") openCenter("credits", triggerRef.current);
              else if (key === "works") go("/assets");
              else if (key === "settings") openOverlay("settings", triggerRef.current);
              else if (key === "logout") logout.mutate();
            }}
          >
            <Dropdown.Section aria-label="积分" className="account-menu-quick">
              <Dropdown.Item
                id="recharge"
                textValue="充值积分"
                className="account-menu-pill account-menu-pill--primary"
              >
                充值积分
              </Dropdown.Item>
              <Dropdown.Item id="ledger" textValue="积分明细" className="account-menu-pill">
                积分明细
              </Dropdown.Item>
            </Dropdown.Section>
            <Dropdown.Section aria-label="会员" className="account-menu-membership">
              <Dropdown.Item
                id="membership"
                textValue="会员 未开通 查看方案"
                className="account-menu-member"
              >
                <UiIcon icon={IconCrown} className="account-menu-crown" />
                <span>会员</span>
                <Chip size="sm" className="account-chip">
                  未开通
                </Chip>
                <span className="account-menu-member-link">
                  查看方案
                  <UiIcon icon={IconChevronRight} size="small" />
                </span>
              </Dropdown.Item>
            </Dropdown.Section>
            <Dropdown.Section aria-label="个人空间">
              <Dropdown.Item id="center" textValue="积分与账单">
                <UiIcon icon={IconUserCircle} />
                <span>积分与账单</span>
              </Dropdown.Item>
              <Dropdown.Item id="works" textValue="个人作品">
                <UiIcon icon={IconPhoto} />
                <span>个人作品</span>
              </Dropdown.Item>
            </Dropdown.Section>
            <Separator className="account-menu-separator" />
            <Dropdown.Section aria-label="账号操作">
              <Dropdown.Item id="settings" textValue="设置">
                <UiIcon icon={IconShieldLock} />
                <span>设置</span>
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
    </div>
  );
}

import { Dropdown, Header } from "@heroui/react";
import { IconCrown, IconFileInvoice, IconSparkle } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { useHoverMenu } from "../../../lib/use-hover-menu";
import { currentPlanName, formatCredits } from "../account-format";
import { useAccountOverlays } from "../account-overlay-store";
import { useWallet } from "../wallet-client";
import { accountMenuMessages } from "./account-menu-messages";
import "./header-benefits.css";

/**
 * 顶部栏积分胶囊：左侧积分与真实企业共享余额，右侧会员等级；
 * 悬停或点按展开积分菜单，可升级、查看余额、开通会员或打开积分明细。
 */
export function HeaderBenefits({
  dismissVersion,
  popoverClassName,
  popoverOffset = 4,
}: {
  dismissVersion?: number;
  popoverClassName?: string;
  popoverOffset?: number;
} = {}) {
  const wallet = useWallet();
  const menu = useHoverMenu(160, dismissVersion);
  const openOverlay = useAccountOverlays((state) => state.open);
  const t = useMessages(accountMenuMessages);
  const plan = currentPlanName(useLocale());
  // 读取失败或尚未读到时显示“—”，不把未知余额当成 0。
  const balance = wallet.data ? formatCredits(wallet.data.balance) : "—";
  function openFromMenu(key: string | number) {
    menu.close();
    // 菜单收起后积分胶囊仍在，弹窗关闭时焦点回到这里。
    const opener = menu.triggerRef.current;
    if (key === "usage") openOverlay("usage", opener);
    else openOverlay("membership", opener);
  }
  return (
    <Dropdown isOpen={menu.isOpen} onOpenChange={menu.onOpenChange}>
      <Dropdown.Trigger
        ref={menu.triggerRef}
        className="header-credits"
        aria-label={t.creditsPill(balance, plan)}
        onHoverStart={(event) => {
          if (event.pointerType === "mouse") menu.openOnHover();
        }}
        onHoverEnd={menu.closeSoon}
      >
        <UiIcon icon={IconSparkle} size="default" />
        <span className="header-credits-value">{balance}</span>
        <span className="header-credits-divider" aria-hidden="true" />
        <span className="header-credits-plan">{plan}</span>
      </Dropdown.Trigger>
      <Dropdown.Popover
        ref={menu.popoverRef}
        className={`credits-menu header-menu${popoverClassName ? ` ${popoverClassName}` : ""}`}
        placement="bottom end"
        offset={popoverOffset}
        isNonModal
        onPointerEnter={menu.cancelClose}
        onPointerLeave={menu.closeSoon}
      >
        <Dropdown.Menu
          aria-label={t.creditsMenu}
          {...(menu.openedByHover ? { autoFocus: false } : {})}
          onAction={openFromMenu}
        >
          <Dropdown.Section aria-label={t.planTier}>
            <Dropdown.Item
              id="upgrade"
              textValue={t.upgradePlan(plan)}
              aria-label={t.upgradePlan(plan)}
              className="credits-menu-plan"
            >
              <span className="credits-menu-plan-name">{plan}</span>
              <span className="credits-menu-upgrade">{t.upgrade}</span>
            </Dropdown.Item>
          </Dropdown.Section>
          <Dropdown.Section>
            <Header className="credits-menu-balance">
              <span>{t.balance}</span>
              <strong>{balance}</strong>
            </Header>
            <Dropdown.Item
              id="membership"
              textValue={t.joinMembership}
              className="credits-menu-action"
            >
              <UiIcon icon={IconCrown} size="navigation" />
              {t.joinMembership}
            </Dropdown.Item>
            <Dropdown.Item id="usage" textValue={t.usage} className="credits-menu-action">
              <UiIcon icon={IconFileInvoice} size="navigation" />
              {t.usage}
            </Dropdown.Item>
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

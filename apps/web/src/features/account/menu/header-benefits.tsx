import { Dropdown, Header } from "@heroui/react";
import { IconFileInvoice, IconShoppingBag } from "@tabler/icons-react";
import { CreditCoin } from "../../../components/credit-coin";
import { UiIcon } from "../../../components/ui-icon";
import { useHoverMenu } from "../../../lib/use-hover-menu";
import { currentPlanName, formatCredits } from "../account-format";
import { useAccountOverlays } from "../account-overlay-store";
import { useWallet } from "../wallet-client";
import "./header-benefits.css";

/**
 * 顶部栏积分胶囊（按 vidmuse）：左侧积分与真实企业共享余额，右侧会员等级；
 * 悬停或点按展开积分菜单，可升级、查看余额、去订阅或打开积分使用详情。
 */
export function HeaderBenefits() {
  const wallet = useWallet();
  const menu = useHoverMenu();
  const openOverlay = useAccountOverlays((state) => state.open);
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
        aria-label={`积分 ${balance}，${currentPlanName}`}
        onHoverStart={(event) => {
          if (event.pointerType === "mouse") menu.openOnHover();
        }}
        onHoverEnd={menu.closeSoon}
      >
        <CreditCoin />
        <span className="header-credits-value">{balance}</span>
        <span className="header-credits-divider" aria-hidden="true" />
        <span className="header-credits-plan">{currentPlanName}</span>
      </Dropdown.Trigger>
      <Dropdown.Popover
        ref={menu.popoverRef}
        className="credits-menu header-menu"
        placement="bottom end"
        offset={4}
        isNonModal
        onPointerEnter={menu.cancelClose}
        onPointerLeave={menu.closeSoon}
      >
        <Dropdown.Menu
          aria-label="积分与会员"
          {...(menu.openedByHover ? { autoFocus: false } : {})}
          onAction={openFromMenu}
        >
          <Dropdown.Section aria-label="会员等级">
            <Dropdown.Item
              id="upgrade"
              textValue={`${currentPlanName}，升级`}
              aria-label={`${currentPlanName}，升级`}
              className="credits-menu-plan"
            >
              <span className="credits-menu-plan-name">{currentPlanName}</span>
              <span className="credits-menu-upgrade">升级</span>
            </Dropdown.Item>
          </Dropdown.Section>
          <Dropdown.Section>
            <Header className="credits-menu-balance">
              <span>积分余额</span>
              <strong>{balance}</strong>
            </Header>
            <Dropdown.Item id="subscribe" textValue="去订阅" className="credits-menu-action">
              <UiIcon icon={IconShoppingBag} size="navigation" />
              去订阅
            </Dropdown.Item>
            <Dropdown.Item id="usage" textValue="积分使用详情" className="credits-menu-action">
              <UiIcon icon={IconFileInvoice} size="navigation" />
              积分使用详情
            </Dropdown.Item>
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

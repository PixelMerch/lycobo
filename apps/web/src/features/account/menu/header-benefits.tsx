import { Button, Dropdown, Header } from "@heroui/react";
import { IconCoins, IconFileInvoice, IconSparkle } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { useHoverMenu } from "../../../lib/use-hover-menu";
import { formatCredits } from "../account-format";
import { useAccountOverlays } from "../account-overlay-store";
import { creditsMessages } from "../credits/credits-messages";
import { useWallet } from "../wallet-client";
import { accountMenuMessages } from "./account-menu-messages";
import "./header-benefits.css";

/** 顶栏展示积分余额、收支菜单和直接购买积分的按钮。 */
export function HeaderBenefits({
  popoverClassName,
  popoverOffset = 4,
}: {
  popoverClassName?: string;
  popoverOffset?: number;
} = {}) {
  const wallet = useWallet();
  const menu = useHoverMenu();
  const openOverlay = useAccountOverlays((state) => state.open);
  const t = useMessages(accountMenuMessages);
  const { purchaseEntry, lowPrice, recharge, walletSources } = useMessages(creditsMessages);
  // 读取失败或尚未读到时显示“—”，不把未知余额当成 0。
  const balance = wallet.data ? formatCredits(wallet.data.balance) : "—";
  const purchased = wallet.data?.purchasedBalance;
  function openFromMenu(key: string | number) {
    menu.close();
    // 菜单收起后积分胶囊仍在，弹窗关闭时焦点回到这里。
    const opener = menu.triggerRef.current;
    if (key === "recharge" || key === "usage") openOverlay(key, opener);
  }
  return (
    <div className="header-credit-controls">
      <Dropdown isOpen={menu.isOpen} onOpenChange={menu.onOpenChange}>
        <Dropdown.Trigger
          ref={menu.triggerRef}
          className="header-credits"
          aria-label={t.creditsPill(balance)}
          onHoverStart={(event) => {
            if (event.pointerType === "mouse") menu.openOnHover();
          }}
          onHoverEnd={menu.closeSoon}
        >
          <UiIcon icon={IconSparkle} size="small" />
          <span className="header-credits-value">{balance}</span>
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
            <Dropdown.Section>
              <Header>
                <div className="credits-menu-balance">
                  <span>{purchased === undefined ? t.balance : walletSources.local}</span>
                  <strong>{balance}</strong>
                </div>
                {purchased !== undefined && (
                  <div className="credits-menu-balance">
                    <span>{walletSources.purchased}</span>
                    <strong>{purchased === null ? "—" : formatCredits(purchased)}</strong>
                  </div>
                )}
              </Header>
              <Dropdown.Item id="recharge" textValue={recharge} className="credits-menu-action">
                <UiIcon icon={IconCoins} size="navigation" />
                {recharge}
              </Dropdown.Item>
              <Dropdown.Item id="usage" textValue={t.usage} className="credits-menu-action">
                <UiIcon icon={IconFileInvoice} size="navigation" />
                {t.usage}
              </Dropdown.Item>
            </Dropdown.Section>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      <Button
        size="sm"
        variant="secondary"
        className="header-credit-purchase"
        aria-label={purchaseEntry}
        aria-haspopup="dialog"
        onPress={({ target }) => {
          menu.close();
          openOverlay("recharge", target instanceof HTMLElement ? target : null);
        }}
      >
        <span>{purchaseEntry}</span>
        <span className="header-credit-purchase-tag" aria-hidden="true">
          {lowPrice}
        </span>
      </Button>
    </div>
  );
}

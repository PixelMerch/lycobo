import { Button, Popover } from "@heroui/react";
import { IconChevronRight, IconCrown } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { CreditCoin } from "../../components/credit-coin";
import { UiIcon } from "../../components/ui-icon";
import { useHoverMenu } from "../../components/use-hover-menu";
import { CreditPreview } from "./credit-preview";
import { CreditsDialog } from "./credits-dialog";
import { useWallet } from "./wallet-client";
import "./header-benefits.css";

/** Two primary actions; the hover preview never intercepts a recharge press. */
export function HeaderBenefits() {
  const wallet = useWallet();
  const [panel, setPanel] = useState<"recharge" | "billing" | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const suppressRestoredHover = useRef(false);
  const preview = useHoverMenu(trigger, ".credit-preview button", {
    openDelay: 250,
    closeDelay: 200,
    keepOpenOnHoveredPress: false,
  });
  const navigate = useNavigate();
  const location = useLocation();
  const balanceLabel = wallet.data?.balance.toLocaleString("zh-CN") ?? "—";
  const openPanel = (next: "recharge" | "billing") => {
    preview.close();
    trigger.current?.focus({ preventScroll: true });
    setPanel(next);
  };
  const openMembership = () => {
    preview.close();
    if (location.pathname !== "/membership") {
      navigate("/membership", { state: { returnTo: location.pathname + location.search } });
    }
  };
  const closePanel = () => {
    suppressRestoredHover.current = true;
    preview.close();
    setPanel(null);
  };
  return (
    <>
      <div className="header-benefits">
        <Button
          ref={trigger}
          variant="tertiary"
          size="sm"
          className="header-balance"
          aria-label={`积分 ${balanceLabel}，充值积分`}
          aria-description="点击充值；悬停或按向下键查看积分明细"
          aria-haspopup="dialog"
          aria-expanded={preview.isOpen}
          {...(panel === null ? preview.triggerProps : {})}
          onPointerEnter={(event) => {
            if (panel === null && !suppressRestoredHover.current)
              preview.triggerProps.onPointerEnter(event);
          }}
          onPointerLeave={(event) => {
            suppressRestoredHover.current = false;
            preview.triggerProps.onPointerLeave(event);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              preview.openFromKeyboard();
            }
          }}
          onPress={() => openPanel("recharge")}
        >
          <CreditCoin size="default" />
          <span className="header-balance-value">{balanceLabel}</span>
          <span className="header-balance-unit">积分</span>
        </Button>
        <span className="header-benefits-divider" aria-hidden="true" />
        <Button variant="tertiary" size="sm" className="header-membership" onPress={openMembership}>
          <UiIcon icon={IconCrown} />
          开通会员
          <UiIcon icon={IconChevronRight} size="small" />
        </Button>
      </div>
      <Popover.Content
        triggerRef={trigger}
        isOpen={preview.isOpen && panel === null}
        onOpenChange={preview.onOpenChange}
        isNonModal
        placement="bottom end"
        offset={10}
        className="credit-preview-popover"
        {...preview.popoverProps}
      >
        <Popover.Dialog aria-label="积分概览" className="credit-preview-dialog">
          {preview.isOpen && (
            <CreditPreview
              onRecharge={() => openPanel("recharge")}
              onDetails={() => openPanel("billing")}
              onMembership={openMembership}
            />
          )}
        </Popover.Dialog>
      </Popover.Content>
      {panel && <CreditsDialog initialView={panel} onClose={closePanel} />}
    </>
  );
}

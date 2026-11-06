import { Button, Popover } from "@heroui/react";
import { IconChevronRight, IconCrown } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { CreditCoin } from "../../components/credit-coin";
import { UiIcon } from "../../components/ui-icon";
import { useAccountOverlays } from "./account-overlay-store";
import { CreditPreview } from "./credit-preview";
import { useWallet } from "./wallet-client";
import "./header-benefits.css";

/** 点击展开积分概览，仅在打开时读取最近流水。 */
export function HeaderBenefits() {
  const wallet = useWallet();
  const trigger = useRef<HTMLButtonElement>(null);
  const membership = useRef<HTMLButtonElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const overlayOpen = useAccountOverlays((state) => state.center !== null || state.dialog !== null);
  const openOverlay = useAccountOverlays((state) => state.open);
  const openCenter = useAccountOverlays((state) => state.openCenter);
  const balanceLabel = wallet.data?.balance.toLocaleString("zh-CN") ?? "—";
  const open = (next: "recharge" | "membership", opener: HTMLElement | null) => {
    setPreviewOpen(false);
    openOverlay(next, opener);
  };
  return (
    <>
      <div className="header-benefits">
        <Button
          ref={trigger}
          variant="tertiary"
          size="sm"
          className="header-balance"
          aria-label={`积分 ${balanceLabel}，查看积分概览`}
          aria-haspopup="dialog"
          aria-expanded={previewOpen}
          onPress={() => setPreviewOpen((current) => !current)}
        >
          <CreditCoin size="default" />
          <span className="header-balance-value">{balanceLabel}</span>
          <span className="header-balance-unit">积分</span>
        </Button>
        <span className="header-benefits-divider" aria-hidden="true" />
        <Button
          ref={membership}
          variant="tertiary"
          size="sm"
          className="header-membership"
          onPress={() => open("membership", membership.current)}
        >
          <UiIcon icon={IconCrown} />
          开通会员
          <UiIcon icon={IconChevronRight} size="small" />
        </Button>
      </div>
      <Popover.Content
        triggerRef={trigger}
        isOpen={previewOpen && !overlayOpen}
        onOpenChange={setPreviewOpen}
        shouldCloseOnInteractOutside={(element) => !trigger.current?.contains(element)}
        isNonModal={false}
        placement="bottom end"
        offset={10}
        className="popover credit-preview-popover"
      >
        <Popover.Dialog aria-label="积分概览" className="popover__dialog credit-preview-dialog">
          {previewOpen && (
            <CreditPreview
              onRecharge={() => open("recharge", trigger.current)}
              onDetails={() => {
                setPreviewOpen(false);
                openCenter("credits", trigger.current);
              }}
              onMembership={() => open("membership", trigger.current)}
            />
          )}
        </Popover.Dialog>
      </Popover.Content>
    </>
  );
}

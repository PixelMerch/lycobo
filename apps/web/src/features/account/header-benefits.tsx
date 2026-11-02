import { Button, Popover } from "@heroui/react";
import { IconChevronRight, IconCrown } from "@tabler/icons-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { CreditCoin } from "../../components/credit-coin";
import { UiIcon } from "../../components/ui-icon";
import { CreditPreview } from "./credit-preview";
import { CreditsDialog } from "./credits-dialog";
import { useWallet } from "./wallet-client";
import "./header-benefits.css";

const MembershipDialog = lazy(() =>
  import("./membership-page").then((module) => ({ default: module.MembershipDialog })),
);

/** Official press-triggered popover; wallet reads mount only while open. */
export function HeaderBenefits() {
  const wallet = useWallet();
  const [panel, setPanel] = useState<"recharge" | "billing" | "membership" | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const restorePanelFocus = useRef(false);
  useEffect(() => {
    if (panel === null && restorePanelFocus.current) {
      restorePanelFocus.current = false;
      trigger.current?.focus({ preventScroll: true });
    }
  }, [panel]);
  const balanceLabel = wallet.data?.balance.toLocaleString("zh-CN") ?? "—";
  const openPanel = (next: "recharge" | "billing") => {
    restorePanelFocus.current = true;
    setPreviewOpen(false);
    trigger.current?.focus({ preventScroll: true });
    setPanel(next);
  };
  const openMembership = () => {
    setPreviewOpen(false);
    setPanel("membership");
  };
  const closePanel = () => {
    setPreviewOpen(false);
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
          aria-label={`积分 ${balanceLabel}，查看积分概览`}
          aria-haspopup="dialog"
          aria-expanded={previewOpen}
          onPress={() => setPreviewOpen((open) => !open)}
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
        isOpen={previewOpen && panel === null}
        onOpenChange={setPreviewOpen}
        shouldCloseOnInteractOutside={(element) => !trigger.current?.contains(element)}
        isNonModal={false}
        placement="bottom end"
        offset={10}
        className="credit-preview-popover"
      >
        <Popover.Dialog aria-label="积分概览" className="credit-preview-dialog">
          {previewOpen && (
            <CreditPreview
              onRecharge={() => openPanel("recharge")}
              onDetails={() => openPanel("billing")}
              onMembership={openMembership}
            />
          )}
        </Popover.Dialog>
      </Popover.Content>
      {panel === "membership" ? (
        <Suspense fallback={null}>
          <MembershipDialog onClose={closePanel} />
        </Suspense>
      ) : (
        panel && <CreditsDialog initialView={panel} onClose={closePanel} />
      )}
    </>
  );
}

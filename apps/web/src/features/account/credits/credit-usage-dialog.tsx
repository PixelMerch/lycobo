import { Modal, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconX } from "@tabler/icons-react";
import { useState } from "react";
import { ValueSkeleton } from "../../../components/data-skeleton";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { formatCredits, totalWalletCredits } from "../account-format";
import { useWallet, type WalletEntryView } from "../wallet-client";
import { CreditUsageList } from "./credit-usage-list";
import { creditsMessages } from "./credits-messages";
import "../account-panel.css";
import "./credit-usage.css";

const views: WalletEntryView[] = ["spent", "earned"];

/** 查看账户最近半年的积分消耗与获得，逐条展开说明及成员。 */
export function CreditUsageDialog({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<WalletEntryView>("spent");
  const wallet = useWallet();
  const balance = totalWalletCredits(wallet.data);
  const balanceText = balance === undefined ? "—" : formatCredits(balance);
  const t = useMessages(creditsMessages);
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Backdrop className="account-backdrop credit-usage-backdrop">
        <Modal.Container>
          <Modal.Dialog className="account-dialog credit-usage-dialog">
            <Modal.Header>
              <Modal.Heading>{t.creditHistory}</Modal.Heading>
              <Modal.CloseTrigger aria-label={t.closeCreditHistory}>
                <UiIcon icon={IconX} size="action" />
              </Modal.CloseTrigger>
            </Modal.Header>
            <Modal.Body className="credit-usage-content">
              <div className="credit-usage-toolbar">
                <ToggleButtonGroup
                  aria-label={t.usageView}
                  size="sm"
                  selectionMode="single"
                  disallowEmptySelection
                  selectedKeys={[view]}
                  onSelectionChange={(keys) => {
                    const next = views.find((id) => keys.has(id));
                    if (next) setView(next);
                  }}
                  className="credit-usage-views"
                >
                  {views.map((id) => (
                    <ToggleButton key={id} id={id}>
                      {t.usageViews[id]}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                <span className="credit-usage-balance">
                  {t.availableBefore}
                  <b>
                    {wallet.isDataPending ? (
                      <ValueSkeleton label={t.loadingBalance} />
                    ) : (
                      balanceText
                    )}
                  </b>
                  {t.availableAfter}
                </span>
              </div>
              {/* 切换视图回到列表顶部，已读取的记录保留在查询缓存中。 */}
              <CreditUsageList key={view} view={view} />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

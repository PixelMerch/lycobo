import { Modal, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import type { WalletSource } from "@lycoboai/contracts";
import { IconX } from "@tabler/icons-react";
import { useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { formatCredits } from "../account-format";
import { useWallet, type WalletEntryView } from "../wallet-client";
import { CreditUsageList } from "./credit-usage-list";
import { CreditWalletSwitch } from "./credit-wallet-switch";
import { creditsMessages } from "./credits-messages";
import "../account-panel.css";
import "./credit-usage.css";

const views: WalletEntryView[] = ["spent", "earned"];

/** 积分明细弹窗：滚动查看企业最近半年的积分消耗与获得，逐条展开说明、成员与结余。 */
export function CreditUsageDialog({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<WalletEntryView>("spent");
  const wallet = useWallet();
  const [selectedSource, setSource] = useState<WalletSource>("local");
  const purchased = wallet.data?.purchasedBalance;
  const source = purchased === undefined ? "local" : selectedSource;
  const balance = source === "purchased" ? purchased : wallet.data?.balance;
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
              {purchased !== undefined && (
                <CreditWalletSwitch value={source} onChange={setSource} />
              )}
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
                  <b>{balance == null ? "—" : formatCredits(balance)}</b>
                  {t.availableAfter}
                </span>
              </div>
              {/* 切换视图回到列表顶部，已读取的记录保留在查询缓存中。 */}
              <CreditUsageList key={`${source}:${view}`} source={source} view={view} />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

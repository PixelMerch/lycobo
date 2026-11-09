import { Modal, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconX } from "@tabler/icons-react";
import { useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { formatCredits } from "../account-format";
import { useWallet } from "../wallet-client";
import { CreditUsageList } from "./credit-usage-list";
import type { UsageView } from "./use-credit-usage";
import "../account-panel.css";
import "./credit-usage.css";

const views: { id: UsageView; label: string }[] = [
  { id: "spent", label: "消耗" },
  { id: "earned", label: "获得" },
];

/** 积分明细弹窗：按消耗／获得两类分页列出企业共享积分的真实收支，逐条展开说明、成员与结余。 */
export function CreditUsageDialog({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<UsageView>("spent");
  const wallet = useWallet();
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Backdrop className="account-backdrop">
        <Modal.Container>
          <Modal.Dialog className="account-dialog credit-usage-dialog">
            <Modal.Header>
              <Modal.Heading>积分明细</Modal.Heading>
              <Modal.CloseTrigger aria-label="关闭积分明细">
                <UiIcon icon={IconX} size="action" />
              </Modal.CloseTrigger>
            </Modal.Header>
            <Modal.Body className="credit-usage-content">
              <div className="credit-usage-toolbar">
                <ToggleButtonGroup
                  aria-label="明细类型"
                  size="sm"
                  selectionMode="single"
                  disallowEmptySelection
                  selectedKeys={[view]}
                  onSelectionChange={(keys) => {
                    const next = views.find((item) => keys.has(item.id));
                    if (next) setView(next.id);
                  }}
                  className="credit-usage-views"
                >
                  {views.map((item) => (
                    <ToggleButton key={item.id} id={item.id}>
                      {item.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                <span className="credit-usage-balance">
                  当前可用 <b>{wallet.data ? formatCredits(wallet.data.balance) : "—"}</b> 积分
                </span>
              </div>
              {/* 切换视图时重新挂载列表，页码回到第一页。 */}
              <CreditUsageList key={view} view={view} />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

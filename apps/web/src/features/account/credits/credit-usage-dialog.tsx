import { Modal, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { IconX } from "@tabler/icons-react";
import { useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { CreditUsageList } from "./credit-usage-list";
import type { UsageView } from "./use-credit-usage";
import "./credit-usage.css";

const views: { id: UsageView; label: string }[] = [
  { id: "spent", label: "已消耗" },
  { id: "earned", label: "已获得" },
];

/** 积分使用明细（按 vidmuse）：已消耗／已获得两类真实收支分页列出，逐条展开说明、成员与结余。 */
export function CreditUsageDialog({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<UsageView>("spent");
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Backdrop className="credit-usage-backdrop">
        <Modal.Container className="credit-usage-container">
          <Modal.Dialog className="credit-usage-dialog">
            <Modal.Header className="credit-usage-header">
              <Modal.Heading className="credit-usage-title">积分使用明细</Modal.Heading>
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
              <Modal.CloseTrigger aria-label="关闭积分使用明细" className="credit-usage-close">
                <UiIcon icon={IconX} size="navigation" />
              </Modal.CloseTrigger>
            </Modal.Header>
            <Modal.Body className="credit-usage-content">
              {/* 切换视图时重新挂载列表，页码回到第一页。 */}
              <CreditUsageList key={view} view={view} />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

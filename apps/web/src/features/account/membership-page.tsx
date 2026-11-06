import { Modal } from "@heroui/react";
import { IconX } from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router";
import { UiIcon } from "../../components/ui-icon";
import { MembershipPlans } from "./membership-plans";
import "./membership-page.css";

/** 全屏展示会员方案，使用实色表面并保留当前页面草稿。 */
export function MembershipDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Backdrop className="membership-backdrop">
        <Modal.Container className="membership-container">
          <Modal.Dialog className="membership-dialog">
            <Modal.Header className="membership-dialog-header">
              <Modal.Heading className="visually-hidden">会员订阅</Modal.Heading>
              <Modal.CloseTrigger aria-label="关闭会员订阅">
                <UiIcon icon={IconX} size="action" />
              </Modal.CloseTrigger>
            </Modal.Header>
            <Modal.Body>
              <MembershipPlans />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

/** 直接访问会员地址时展示相同方案，关闭后返回受支持的站内页面。 */
export function MembershipPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state: unknown = location.state;
  const returnTo =
    typeof state === "object" &&
    state !== null &&
    "returnTo" in state &&
    typeof state.returnTo === "string" &&
    /^\/(?:$|commerce(?:[/?]|$)|assets(?:[/?]|$))/.test(state.returnTo)
      ? state.returnTo
      : "/workspace";
  return <MembershipDialog onClose={() => navigate(returnTo, { replace: true })} />;
}

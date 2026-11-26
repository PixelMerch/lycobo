import { Modal } from "@heroui/react";
import { useId } from "react";
import { LoginCard } from "../../auth/login-page";

/** 在首页复用现有登录方式，完成后继续打开用户选中的结账。 */
export function LandingPricingLogin({
  returnTo,
  onClose,
  onSuccess,
}: {
  returnTo: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const titleId = useId();
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="pricing-login-dialog" aria-labelledby={titleId}>
            <LoginCard
              returnTo={returnTo}
              socialFailed={false}
              titleId={titleId}
              onClose={onClose}
              onLoginSuccess={onSuccess}
            />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

import { IconPhotoX, IconRefresh } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import "./failure-retry-label.css";

export function FailureRetryLabel({ compact = false }: { compact?: boolean }) {
  const size = compact ? "action" : "illustration";
  return (
    <span className="failure-retry-label" aria-hidden="true">
      <span className="failure-label">
        <UiIcon icon={IconPhotoX} size={size} />
        <span>失败</span>
      </span>
      <span className="retry-label">
        <UiIcon icon={IconRefresh} size={size} />
        <span>重试</span>
      </span>
    </span>
  );
}

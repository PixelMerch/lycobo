import { Spinner } from "@heroui/react";
import { useMessages } from "../i18n/messages";
import { componentsMessages } from "./components-messages";

type LoadingStateProps = {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
};

/** 整屏加载状态：不透明底色盖住页面内容，加载指示不会叠在导航或卡片上。 */
export function LoadingState({ label, className, size = "lg" }: LoadingStateProps) {
  const t = useMessages(componentsMessages);
  return (
    <div
      className={className ? `loading-state ${className}` : "loading-state"}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <Spinner aria-hidden size={size} />
      <span className="loading-state-label">{label ?? t.loading}</span>
    </div>
  );
}

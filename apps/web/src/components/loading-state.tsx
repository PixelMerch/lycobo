import { Spinner } from "@heroui/react";

type LoadingStateProps = {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
};

/**
 * Full-screen loading surface. The opaque background covers page content so the
 * indicator never overlaps navigation, cards or other background elements.
 */
export function LoadingState({ label = "加载中", className, size = "lg" }: LoadingStateProps) {
  return (
    <div
      className={className ? `loading-state ${className}` : "loading-state"}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <Spinner aria-hidden size={size} />
      <span className="loading-state-label">{label}</span>
    </div>
  );
}

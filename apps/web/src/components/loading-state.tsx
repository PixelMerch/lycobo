import { useMessages } from "../i18n/messages";
import { componentsMessages } from "./components-messages";

type LoadingStateProps = {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
};

const markSizes = { sm: 24, md: 40, lg: 56, xl: 72 };

/** 整屏等待时展示共用的品牌标志，并为读屏软件提供当前语言的加载状态。 */
export function LoadingState({ label, className, size = "lg" }: LoadingStateProps) {
  const t = useMessages(componentsMessages);
  return (
    <div className={className ? `loading-state ${className}` : "loading-state"} role="status">
      <img
        className="loading-state-mark"
        src="/brand/lycobo-loading.svg"
        width={markSizes[size]}
        height={markSizes[size]}
        alt=""
      />
      <span className="visually-hidden">{label ?? t.loading}</span>
    </div>
  );
}

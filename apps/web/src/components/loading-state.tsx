import { useMessages } from "../i18n/messages";
import { componentsMessages } from "./components-messages";

type LoadingStateProps = {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
};

const markHeights = { sm: 20, md: 24, lg: 30, xl: 40 };

/** 整屏等待时展示共用的品牌标志，并为读屏软件提供当前语言的加载状态。 */
export function LoadingState({ label, className, size = "lg" }: LoadingStateProps) {
  const t = useMessages(componentsMessages);
  const height = markHeights[size];
  return (
    <div className={className ? `loading-state ${className}` : "loading-state"} role="status">
      <img
        className="loading-state-mark"
        src="/brand/lycobo-loading.svg"
        width={Math.round((height * 11) / 7)}
        height={height}
        alt=""
      />
      <span className="visually-hidden">{label ?? t.loading}</span>
    </div>
  );
}

import { HashLoader } from "react-spinners";
import { useMessages } from "../i18n/messages";
import { componentsMessages } from "./components-messages";

type LoadingStateProps = {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
};

const loaderSizes = { sm: 20, md: 24, lg: 30, xl: 40 };

/** 展示主题色加载动画，并为读屏软件提供当前语言的加载状态。 */
export function LoadingState({ label, className, size = "lg" }: LoadingStateProps) {
  const t = useMessages(componentsMessages);
  const pixels = loaderSizes[size];
  return (
    <div className={className ? `loading-state ${className}` : "loading-state"} role="status">
      <span className="loading-state-animation" aria-hidden="true">
        <HashLoader className="loading-state-spinner" color="#A8FF00" size={pixels} />
      </span>
      <span
        className="loading-state-placeholder loading-state-reduced"
        style={{ fontSize: pixels }}
        aria-hidden="true"
      />
      <span className="visually-hidden">{label ?? t.loading}</span>
    </div>
  );
}

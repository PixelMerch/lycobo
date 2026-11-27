import { Skeleton } from "@heroui/react";
import { useMessages } from "../i18n/messages";
import { componentsMessages } from "./components-messages";
import "./data-skeleton.css";

/** 为首次读取的数值保留行内位置，并向读屏软件说明状态。 */
export function ValueSkeleton({ label }: { label?: string }) {
  const t = useMessages(componentsMessages);
  return (
    <Skeleton<"span">
      render={(props) => <span {...props} />}
      className="data-value-skeleton"
      role="status"
      aria-label={label ?? t.loading}
    />
  );
}

/** 在图片或视频首次读取时占据舞台中心。 */
export function MediaSkeleton({ label, aspect = 1 }: { label: string; aspect?: number }) {
  return (
    <Skeleton
      className="data-media-skeleton"
      style={{ aspectRatio: aspect }}
      role="status"
      aria-label={label}
    />
  );
}

/** 按数据区的实际布局显示首次加载占位。 */
export function DataSkeleton({
  label,
  layout = "list",
}: {
  label?: string;
  layout?: "list" | "table" | "history" | "rail" | "options";
}) {
  const t = useMessages(componentsMessages);
  return (
    <div
      className="data-skeleton"
      data-layout={layout}
      role="status"
      aria-label={label ?? t.loadingList}
    >
      {["first", "second", "third"].map((row) => (
        <div className="data-skeleton-row" key={row} aria-hidden="true">
          <Skeleton className="data-skeleton-leading" />
          <Skeleton className="data-skeleton-primary" />
          <Skeleton className="data-skeleton-secondary" />
        </div>
      ))}
    </div>
  );
}

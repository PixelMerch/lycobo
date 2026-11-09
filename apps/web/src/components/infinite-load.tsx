import { Spinner } from "@heroui/react";
import { useEffect, useRef } from "react";
import "./infinite-load.css";
import { useMessages } from "../i18n/messages";
import { componentsMessages } from "./components-messages";

/** 列表末尾的共用加载哨兵，进入所在滚动区域的可视范围时加载下一页。 */
export function InfiniteLoad({
  hasMore,
  isLoading,
  isError = false,
  onLoadMore,
}: {
  hasMore: boolean;
  isLoading: boolean;
  isError?: boolean;
  onLoadMore: () => unknown;
}) {
  const t = useMessages(componentsMessages);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !hasMore || isLoading || isError) return;
    let requested = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || requested) return;
      requested = true;
      void Promise.resolve()
        .then(onLoadMore)
        .catch(() => {
          // 失败由所属查询报告，重试也由它负责。
        });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isError, onLoadMore]);
  if (!hasMore && !isLoading) return null;
  return (
    <div className="infinite-load" ref={sentinel}>
      {isLoading && <Spinner size="sm" aria-label={t.loadingList} />}
    </div>
  );
}

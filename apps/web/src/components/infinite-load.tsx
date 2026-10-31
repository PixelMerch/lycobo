import { Spinner } from "@heroui/react";
import { useEffect, useRef } from "react";
import "./infinite-load.css";

/** A shared end-of-list sentinel, clipped by its enclosing scroll viewport. */
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
          // The owning query exposes its error and owns any explicit retry action.
        });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isError, onLoadMore]);
  if (!hasMore && !isLoading) return null;
  return (
    <div className="infinite-load" ref={sentinel}>
      {isLoading && <Spinner size="sm" aria-label="正在加载列表" />}
    </div>
  );
}

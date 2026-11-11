import { useEffect, useRef, useState } from "react";

// 首页作品墙先显示 10 张，滚到底部附近再补两次、每次 4 张；之后换成“查看更多灵感”，
// 每点一次在当前页再加 10 张，不跳转（用户 2026-11-11 要求）。
const firstPage = 10;
const scrollStep = 4;
const maxScrollLoads = 2;
const moreStep = 10;
// 补完一批后 600ms 内的滚动不再触发，一次快速滑动只算一次，第二批要再滚一次。
const cooldownMs = 600;

/** 已加载 loads 次后首页应显示的张数：前两次是滚动补的，之后每次是点“查看更多灵感”加的，不超过总数。 */
export function shownCount(total: number, loads: number) {
  const scrolled = Math.min(loads, maxScrollLoads) * scrollStep;
  const pressed = Math.max(loads - maxScrollLoads, 0) * moreStep;
  return Math.min(total, firstPage + scrolled + pressed);
}

/** 滚动加载是否到头：补满两次，或者这个分类的示例已经全部显示。 */
export function pagingFinished(total: number, loads: number) {
  return loads >= maxScrollLoads || shownCount(total, loads) >= total;
}

/**
 * 首页作品墙的分批加载：用户滚动时，底部哨兵进入视口（下方留 80px 余量）就补一批，最多两次；切换分类从头计算。
 * 只在滚动时判断，打开页面不会自动加载；补完一批后冷却 600ms，冷却后仍停在底部就接着补，最多两次。
 * 滚动补完后由 loadMore（“查看更多灵感”）接着加载，页脚始终看得到。
 */
export function useInspirationPaging(total: number, category: string) {
  const [state, setState] = useState({ category, loads: 0 });
  const loads = state.category === category ? state.loads : 0;
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);
  const finished = pagingFinished(total, loads);
  const count = shownCount(total, loads);
  const lastLoadAt = useRef(0);
  useEffect(() => {
    if (!sentinel || finished) return;
    let frame = 0;
    let timer = 0;
    function check() {
      frame = 0;
      if (!sentinel || sentinel.getBoundingClientRect().top > window.innerHeight + 80) return;
      const wait = lastLoadAt.current + cooldownMs - performance.now();
      if (wait > 0) {
        // 冷却中：到点再看一次；用户一口气滑到底、停在底部时也能接着补第二批，不会卡住。
        if (!timer)
          timer = window.setTimeout(() => {
            timer = 0;
            check();
          }, wait);
        return;
      }
      lastLoadAt.current = performance.now();
      setState({ category, loads: loads + 1 });
    }
    // 滚动事件用一帧合并一次，避免每个滚动事件都量一次位置。
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(check);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    // 刚补完一批时立即看一次，哨兵还在底部就等冷却结束后补下一批。
    if (lastLoadAt.current > 0) check();
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [sentinel, finished, category, loads]);
  return {
    count,
    finished,
    hasMore: count < total,
    loadMore: () => setState({ category, loads: loads + 1 }),
    sentinelRef: setSentinel,
  };
}

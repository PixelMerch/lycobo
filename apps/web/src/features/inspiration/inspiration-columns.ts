import { useCallback, useSyncExternalStore } from "react";

// 卡片高宽比（高 ÷ 宽），与 CSS 里各形状的 aspect-ratio 一致；另计入卡片间距。
const heightByShape = { portrait: 1.25, square: 1, landscape: 0.75 } as const;
const gapRatio = 0.06;
const breakpoints = [640, 900, 1120, 1360, 1640];

type Shaped = { shape: keyof typeof heightByShape };
/** 瀑布流的一列：稳定的 id 与按顺序放进来的卡片。 */
export type InspirationColumn<T> = { id: string; items: T[] };

/**
 * 按顺序把卡片放进当前最矮的一列，避免某一列大片留空。
 * 只往列表末尾追加时，前面的卡片仍在原来的列和位置，滚动加载不会让已看过的卡片跳动。
 */
export function distributeColumns<T extends Shaped>(
  items: readonly T[],
  count: number,
): InspirationColumn<T>[] {
  const columns: { id: string; items: T[]; height: number }[] = Array.from(
    { length: Math.max(1, count) },
    (_, index) => ({ id: `inspiration-column-${index}`, items: [], height: 0 }),
  );
  for (const item of items) {
    const shortest = columns.reduce((lowest, column) =>
      column.height < lowest.height ? column : lowest,
    );
    shortest.items.push(item);
    shortest.height += heightByShape[item.shape] + gapRatio;
  }
  return columns.map(({ id, items: columnItems }) => ({ id, items: columnItems }));
}

function breakpointQuery(width: number) {
  return window.matchMedia(`(min-width: ${width}px)`);
}

/** 按视口更新灵感库瀑布流列数。 */
export function useColumnCount() {
  const subscribe = useCallback((onChange: () => void) => {
    const queries = breakpoints.map(breakpointQuery);
    for (const query of queries) query.addEventListener("change", onChange);
    return () => {
      for (const query of queries) query.removeEventListener("change", onChange);
    };
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => 2 + breakpoints.filter((width) => breakpointQuery(width).matches).length,
    () => 4,
  );
}

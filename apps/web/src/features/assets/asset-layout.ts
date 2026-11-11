import type { Locale } from "../../i18n/locale";
import { assetsMessages } from "./assets-messages";

/** Pure layout for the asset library: day groups, equal-height rows and a phone masonry. */
type Sized = { width: number; height: number };

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * 素材的日期分组标题：“今天 · 11月3日 周二”“昨天 · …”，更早的显示日期本身；按本地时间与界面语言书写，
 * 英文为 “Today · Nov 3 Tue”“Dec 31, 2025”。
 */
export function dayHeading(iso: string, locale: Locale, now = new Date()) {
  const date = new Date(iso);
  const days = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000);
  const t = assetsMessages[locale];
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date);
  const monthDay = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(date);
  if (days === 0) return { label: t.today, detail: `${monthDay} ${weekday}` };
  if (days === 1) return { label: t.yesterday, detail: `${monthDay} ${weekday}` };
  if (date.getFullYear() === now.getFullYear()) return { label: monthDay, detail: weekday };
  const fullDate = new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
  return { label: fullDate, detail: weekday };
}

/** Keeps the server's newest-first order and starts a group whenever the local day changes. */
export function groupByDay<T extends { created_at: string }>(items: readonly T[]) {
  const groups: { key: string; first: string; items: T[] }[] = [];
  for (const item of items) {
    const date = new Date(item.created_at);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, first: item.created_at, items: [item] });
  }
  return groups;
}

// 素材区宽度对应的列数：1920 屏 6 列、1440 屏 5 列，越窄越少，手机 2 列。
const columnSteps = [
  [1560, 6],
  [1180, 5],
  [880, 4],
  [600, 3],
] as const;

/** 按素材区实际宽度决定瀑布流列数。 */
export function assetColumns(width: number) {
  return columnSteps.find(([minimum]) => width >= minimum)?.[1] ?? 2;
}

/** Missing dimensions reserve a square until authoritative metadata is available. */
export const aspectRatio = ({ width, height }: Sized) =>
  width > 0 && height > 0 ? width / height : 1;

/** Place in the shortest column while keeping the input/keyboard/preview order unchanged. */
export function masonryPositions<T extends Sized>(
  items: readonly T[],
  width: number,
  count: number,
  gap: number,
) {
  if (width <= 0 || count < 1) return [];
  const heights = Array.from({ length: count }, () => 0);
  const columnWidth = (width - gap * (count - 1)) / count;
  return items.map((item) => {
    const column = heights.indexOf(Math.min(...heights));
    const top = heights[column] ?? 0;
    const height = columnWidth / aspectRatio(item);
    heights[column] = top + Math.ceil(height) + gap;
    return { column: column + 1, row: top + 1, span: Math.ceil(height), height };
  });
}

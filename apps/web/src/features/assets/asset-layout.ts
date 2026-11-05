/** Pure layout for the asset library: day groups, equal-height rows and a phone masonry. */
type Sized = { width: number; height: number };

const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const monthDay = (date: Date) => `${date.getMonth() + 1}月${date.getDate()}日`;

/** “今天 · 11月3日 周二”, “昨天 · …”, or the date itself; local time, like the rest of the app. */
export function dayHeading(iso: string, now = new Date()) {
  const date = new Date(iso);
  const days = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000);
  const weekday = weekdays[date.getDay()] ?? "";
  if (days === 0) return { label: "今天", detail: `${monthDay(date)} ${weekday}` };
  if (days === 1) return { label: "昨天", detail: `${monthDay(date)} ${weekday}` };
  const label =
    date.getFullYear() === now.getFullYear()
      ? monthDay(date)
      : `${date.getFullYear()}年${monthDay(date)}`;
  return { label, detail: weekday };
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

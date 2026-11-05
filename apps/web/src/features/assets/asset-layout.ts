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

/** Extreme panoramas or strips are clamped so one picture cannot flatten a whole row. */
export const aspectRatio = ({ width, height }: Sized) =>
  width > 0 && height > 0 ? Math.min(Math.max(width / height, 0.4), 3) : 1;

/**
 * Rows share one height and fill the width exactly, so pictures keep their own ratio uncropped.
 * The last row of a group keeps the target height instead of stretching a few pictures.
 */
export function justifyRows<T extends Sized>(
  items: readonly T[],
  width: number,
  target: number,
  gap: number,
) {
  if (width <= 0) return [];
  const rows: { height: number; items: { item: T; width: number }[] }[] = [];
  let row: T[] = [];
  const close = (height: number) => {
    rows.push({ height, items: row.map((item) => ({ item, width: height * aspectRatio(item) })) });
    row = [];
  };
  for (const item of items) {
    row.push(item);
    const ratio = row.reduce((sum, entry) => sum + aspectRatio(entry), 0);
    if (ratio * target + gap * (row.length - 1) >= width)
      close((width - gap * (row.length - 1)) / ratio);
  }
  if (row.length) close(target);
  return rows;
}

/** Phones use two columns; each picture joins the currently shorter column. */
export function masonryColumns<T extends Sized>(items: readonly T[], count: number) {
  const columns = Array.from({ length: count }, (): { height: number; items: T[] } => ({
    height: 0,
    items: [],
  }));
  for (const item of items) {
    const column = columns.reduce((low, next) => (next.height < low.height ? next : low));
    column.items.push(item);
    column.height += 1 / aspectRatio(item);
  }
  return columns.map((column) => column.items);
}

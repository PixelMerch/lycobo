import type { Locale } from "../../../i18n/locale";

/** 本地日历日的键：同一天的任务得到同一个键。 */
function localDay(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** 右侧索引的日期小标题：今天、昨天，其余显示月日，跨年时带上年份；时间无法解析时返回 null。 */
export function historyDayLabel(
  createdAt: string,
  now: Date,
  locale: Locale,
  words: { today: string; yesterday: string },
) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (localDay(date) === localDay(now)) return words.today;
  if (localDay(date) === localDay(yesterday)) return words.yesterday;
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (date.getFullYear() !== now.getFullYear()) options.year = "numeric";
  return new Intl.DateTimeFormat(locale, options).format(date);
}

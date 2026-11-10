import { localeFromPath, withoutLocale } from "../../../i18n/locale-path";

type HistoryNavigation = {
  key: string;
  pathname: string;
  search: string;
  hash: string;
};

/** 仅换语言时沿用定位标识，避免已展示的任务再次滚动并抢走焦点。 */
export function historyLocaleNavigation(
  previous: HistoryNavigation | null,
  current: HistoryNavigation,
) {
  if (
    previous &&
    localeFromPath(previous.pathname) !== localeFromPath(current.pathname) &&
    withoutLocale(previous.pathname) === withoutLocale(current.pathname) &&
    previous.search === current.search &&
    previous.hash === current.hash
  )
    return { ...current, key: previous.key };
  return current;
}

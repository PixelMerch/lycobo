import { create } from "zustand";
import { detectLocale, type Locale, parseLocale } from "./locale";

const storageKey = "lycobo.locale";

// 隐私模式或禁用存储时读不到，按没有保存处理。
function readSavedLocale() {
  try {
    return parseLocale(window.localStorage.getItem(storageKey));
  } catch {
    return null;
  }
}

function saveLocale(locale: Locale) {
  try {
    window.localStorage.setItem(storageKey, locale);
  } catch {
    // 存不下时本次访问仍按新语言显示，下次打开再跟随浏览器语言。
  }
}

function browserLanguages() {
  if (navigator.languages.length > 0) return navigator.languages;
  return [navigator.language];
}

/** 当前界面语言：首次访问跟随浏览器语言，用户在语言菜单里选过之后记住选择。 */
export const useLocaleStore = create<{ locale: Locale; setLocale: (locale: Locale) => void }>(
  (set) => ({
    locale: readSavedLocale() ?? detectLocale(browserLanguages()),
    setLocale: (locale) => {
      saveLocale(locale);
      set({ locale });
    },
  }),
);

/** 组件里读取当前界面语言，切换语言后自动重新渲染。 */
export function useLocale() {
  return useLocaleStore((state) => state.locale);
}

/** 组件之外（请求、错误、通知）读取调用这一刻的界面语言。 */
export function currentLocale() {
  return useLocaleStore.getState().locale;
}

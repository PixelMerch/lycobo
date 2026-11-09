import type { Locale } from "./locale";
import { currentLocale, useLocaleStore } from "./locale-store";
import { defineMessages } from "./messages";

const documentMessages = defineMessages({
  "zh-CN": { title: "Lycobo · 电商创作工作台" },
  en: { title: "Lycobo · E-commerce Creative Studio" },
});

/** 当前语言下的标签页标题。 */
export function documentTitle() {
  return documentMessages[currentLocale()].title;
}

function applyLocale(locale: Locale) {
  document.documentElement.lang = locale;
  document.title = documentMessages[locale].title;
}

/** 让页面的 lang 属性和标签页标题跟随界面语言；应用启动时调用一次。 */
export function syncDocumentLocale() {
  applyLocale(currentLocale());
  useLocaleStore.subscribe((state, previous) => {
    if (state.locale !== previous.locale) applyLocale(state.locale);
  });
}

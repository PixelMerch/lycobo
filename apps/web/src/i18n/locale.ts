import { type AccountLocale, accountLocales } from "@lycoboai/contracts";

/** 站点支持的界面语言，第一项是中文。 */
export const locales = accountLocales;

/** 界面语言代码。 */
export type Locale = AccountLocale;

/** 语言菜单里的名称：每种语言用它自己的文字书写，看不懂当前界面的人也能认出来。 */
export const localeNames: Record<Locale, string> = { "zh-CN": "简体中文", en: "English" };

/** 顶部栏语言入口上的短名称。 */
export const localeShortNames: Record<Locale, string> = { "zh-CN": "中文", en: "EN" };

/** 把存储里读到的值收窄成支持的语言；其他值一律视为没有保存过。 */
export function parseLocale(value: unknown): Locale | null {
  return locales.find((locale) => locale === value) ?? null;
}

/**
 * 按浏览器的语言偏好顺序，取第一个本站支持的语言：中文（含繁体）用简体中文，英文用 English；
 * 列表里都没有时用 English。
 */
export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const tag = language.toLowerCase();
    if (tag === "zh" || tag.startsWith("zh-")) return "zh-CN";
    if (tag === "en" || tag.startsWith("en-")) return "en";
  }
  return "en";
}

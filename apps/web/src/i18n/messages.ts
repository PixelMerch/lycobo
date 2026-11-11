import type { Locale } from "./locale";
import { currentLocale, useLocale } from "./locale-store";

/** 一组界面文案：每种语言一份，结构完全相同。 */
export type MessageCatalog<T> = Record<Locale, T>;

/**
 * 定义一组界面文案。结构以中文版为准，英文版少一个键、多一个键或参数不同都会编译失败；
 * 需要插入数字或名称的文案写成函数。
 */
export function defineMessages<T>(catalog: { "zh-CN": T; en: NoInfer<T> }): MessageCatalog<T> {
  return catalog;
}

/** 组件里读取当前语言的文案，切换语言后自动重新渲染。 */
export function useMessages<T>(catalog: MessageCatalog<T>): T {
  return catalog[useLocale()];
}

/** 组件之外（请求、错误、通知）读取调用这一刻的语言的文案。 */
export function currentMessages<T>(catalog: MessageCatalog<T>): T {
  return catalog[currentLocale()];
}

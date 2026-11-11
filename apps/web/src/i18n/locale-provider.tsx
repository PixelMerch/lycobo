import { I18nProvider } from "@heroui/react";
import type { ReactNode } from "react";
import { useLocale } from "./locale-store";

/** 让 HeroUI 组件自带的文字（关闭按钮、分页等读屏文字）也跟随界面语言。 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  return <I18nProvider locale={useLocale()}>{children}</I18nProvider>;
}

import type { Locale } from "../../i18n/locale";
import { qualityMessages } from "./quality-messages";

/** 质量档位的显示名称，例如 medium 显示为“标准”；未知档位原样显示。 */
export function qualityLabel(locale: Locale, level: string) {
  const names: Record<string, string> = qualityMessages[locale].levels;
  return names[level] ?? level;
}

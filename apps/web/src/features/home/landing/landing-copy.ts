import type { Locale } from "../../../i18n/locale";
import { legalMessages } from "../../legal/legal-messages";
import { siteFooterMessages } from "../../site/site-footer-messages";
import { accessibilityMessages } from "./accessibility-messages";
import { guidanceMessages } from "./guidance-messages";
import { navigationMessages } from "./navigation-messages";
import { storyMessages } from "./story-messages";

/** 将各段双语文案汇总给隔离模板，原版动效读取已本地化的内容。 */
export function landingCopy(locale: Locale): Record<string, string> {
  const legal = legalMessages[locale].names;
  const footer = siteFooterMessages[locale];
  return {
    ...navigationMessages[locale],
    ...storyMessages[locale],
    ...guidanceMessages[locale],
    ...accessibilityMessages[locale],
    footerNavigation: footer.navigation,
    footerTerms: legal.terms,
    footerPrivacy: legal.privacy,
    footerCopyright: footer.copyright(new Date().getFullYear()),
  };
}

import type { Locale } from "../../../i18n/locale";
import { siteFooterMessages } from "../../site/site-footer-messages";
import { siteFooterSupportEmail } from "../../site/site-footer-navigation";
import { landingMessages } from "./landing-messages";

/** 将三段首页的简短文案与共用版权信息交给隔离正文。 */
export function landingCopy(locale: Locale): Record<string, string> {
  const footer = siteFooterMessages[locale];
  return {
    ...landingMessages[locale],
    footerNavigation: footer.navigation,
    footerSupportEmail: siteFooterSupportEmail,
    footerCopyright: footer.copyright(new Date().getFullYear()),
  };
}

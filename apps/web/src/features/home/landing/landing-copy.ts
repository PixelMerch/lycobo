import type { Locale } from "../../../i18n/locale";
import { siteFooterMessages } from "../../site/site-footer-messages";
import { siteFooterSupportEmail } from "../../site/site-footer-navigation";
import { landingFaqMessages } from "./landing-faq-messages";
import { landingMessages } from "./landing-messages";

/** 将首页能力、积分常见问题与共用版权文案交给隔离正文。 */
export function landingCopy(locale: Locale): Record<string, string> {
  const footer = siteFooterMessages[locale];
  return {
    ...landingMessages[locale],
    ...landingFaqMessages[locale],
    footerNavigation: footer.navigation,
    footerSupportEmail: siteFooterSupportEmail,
    footerCopyright: footer.copyright(new Date().getFullYear()),
  };
}

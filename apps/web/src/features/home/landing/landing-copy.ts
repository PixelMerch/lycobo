import type { Locale } from "../../../i18n/locale";
import { siteFooterMessages } from "../../site/site-footer-messages";
import { landingFaqMessages } from "./landing-faq-messages";
import { landingFooterMessages } from "./landing-footer-messages";
import { landingMessages } from "./landing-messages";
import { landingReviewsMessages } from "./landing-reviews-messages";

/** 将首页能力、示例评价、积分问答和分栏页脚文案交给隔离正文。 */
export function landingCopy(locale: Locale): Record<string, string> {
  const footer = siteFooterMessages[locale];
  return {
    ...landingMessages[locale],
    ...landingFaqMessages[locale],
    ...landingFooterMessages[locale],
    ...landingReviewsMessages[locale],
    footerNavigation: footer.navigation,
    footerCopyright: footer.copyright(new Date().getFullYear()),
  };
}

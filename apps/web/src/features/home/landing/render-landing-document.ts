import footerWordmark from "../../../../public/brand/lycobo-footer-wordmark.svg?inline";
import optimizeImage from "../../../../public/landing/campaign/espresso-prompt.webp?inline";
import collectionImage from "../../../../public/landing/campaign/handbag-collection.webp?inline";
import setImage from "../../../../public/landing/campaign/lamp-image-set.webp?inline";
import sceneImage from "../../../../public/landing/campaign/lamp-scene.webp?inline";
import lampSourceImage from "../../../../public/landing/campaign/lamp-source.webp?inline";
import heroImage from "../../../../public/landing/campaign/surfboard-campaign.webp?inline";
import heroSourceImage from "../../../../public/landing/campaign/surfboard-source.webp?inline";
import textileImage from "../../../../public/landing/campaign/textile-views.webp?inline";
import { initializePageScrollbar } from "../../../components/page-scrollbar";
import pageScrollbarStyle from "../../../components/page-scrollbar.css?raw";
import type { Locale } from "../../../i18n/locale";
import studioPalette from "../../../styles/studio-palette.css?raw";
import siteFooterStyles from "../../site/site-footer.css?raw";
import faqStyles from "./landing-faq.css?raw";
import faqTemplate from "./landing-faq.html?raw";
import { createLandingFeatureMotion } from "./landing-feature-motion";
import featureStyles from "./landing-features.css?raw";
import featureTemplate from "./landing-features.html?raw";
import footerStyles from "./landing-footer.css?raw";
import { initializeLandingFooterOverlay } from "./landing-footer-overlay";
import { initializeLandingFrameBridge } from "./landing-frame-bridge";
import heroStyles from "./landing-hero.css?raw";
import heroTemplate from "./landing-hero.html?raw";
import motionStyles from "./landing-motion.css?raw";
import { createLandingMotionTimeline } from "./landing-motion-timeline";
import landingPalette from "./landing-palette.css?raw";
import pricingStyles from "./landing-pricing.css?raw";
import { renderLandingPricing } from "./landing-pricing-template";
import reviewsStyles from "./landing-reviews.css?raw";
import { initializeLandingReviews } from "./landing-reviews-motion";
import { renderLandingReviews } from "./landing-reviews-template";
import { initializeLandingMotion } from "./landing-showcase";
import showcaseStyles from "./landing-showcase.css?raw";
import showcaseTemplate from "./landing-showcase.html?raw";
import landingTheme from "./landing-theme.css?raw";
import { renderLandingFooter } from "./render-landing-footer";

const landingImages: Record<string, string> = {
  hero: heroImage,
  source: heroSourceImage,
  scene: sceneImage,
  set: setImage,
  lamp: lampSourceImage,
  collection: collectionImage,
  textile: textileImage,
  optimize: optimizeImage,
};
const htmlEntities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (character) => htmlEntities[character] ?? character);

/** 将首页各区块的图片、样式和滚动脚本内联到隔离正文，并转义中英文文案。 */
export function renderLandingDocument(
  template: string,
  messages: Record<string, string>,
  locale: Locale,
) {
  return template
    .replace("__LYCOBO_LANDING_APPEARANCE__", () =>
      [studioPalette, landingTheme, landingPalette, motionStyles].join("\n"),
    )
    .replace("__LYCOBO_HERO_STYLE__", () =>
      [
        heroStyles,
        showcaseStyles,
        featureStyles,
        reviewsStyles,
        pricingStyles,
        faqStyles,
        siteFooterStyles,
        footerStyles,
      ].join("\n"),
    )
    .replace("__LYCOBO_HERO__", () => heroTemplate)
    .replace("__LYCOBO_SHOWCASE__", () => showcaseTemplate)
    .replace("__LYCOBO_FEATURES__", () => featureTemplate)
    .replace("__LYCOBO_REVIEWS__", renderLandingReviews)
    .replace("__LYCOBO_PRICING__", () => renderLandingPricing(locale))
    .replace("__LYCOBO_FAQ__", () => faqTemplate)
    .replace("__LYCOBO_FOOTER__", () => renderLandingFooter(locale, footerWordmark, escapeHtml))
    .replace(/__LYCOBO_IMAGE_([a-z]+)__/g, (marker, name: string) => landingImages[name] ?? marker)
    .replace(
      "__LYCOBO_MOTION_SCRIPT__",
      () =>
        `(${initializeLandingMotion.toString()})(() => (${createLandingMotionTimeline.toString()})(${createLandingFeatureMotion.toString()}));
        (${initializeLandingFooterOverlay.toString()})();`,
    )
    .replace(
      "__LYCOBO_LANDING_FRAME_SCRIPT__",
      () => `(${initializeLandingFrameBridge.toString()})();`,
    )
    .replace("__LYCOBO_SCROLLBAR_STYLE__", () => pageScrollbarStyle)
    .replace("__LYCOBO_REVIEWS_SCRIPT__", () => `(${initializeLandingReviews.toString()})();`)
    .replace("__LYCOBO_SCROLLBAR_SCRIPT__", () => `(${initializePageScrollbar.toString()})();`)
    .replaceAll("__LYCOBO_LOCALE__", locale)
    .replace(/__LYCOBO_(HTML|JS)_([a-zA-Z0-9]+)__/g, (_, context: string, key: string) => {
      const message = messages[key];
      if (message === undefined) throw new Error(`Missing landing message: ${key}`);
      if (context === "JS") {
        return JSON.stringify(message)
          .slice(1, -1)
          .replaceAll("<", "\\u003c")
          .replaceAll("\u2028", "\\u2028")
          .replaceAll("\u2029", "\\u2029");
      }
      return escapeHtml(message);
    });
}

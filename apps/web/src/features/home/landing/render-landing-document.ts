import footerWordmark from "../../../../public/brand/lycobo-footer-wordmark.svg?inline";
import sceneImage from "../../../../public/landing/campaign/headphones-scene.webp?inline";
import setImage from "../../../../public/landing/campaign/skincare-set.webp?inline";
import shoeImage from "../../../../public/landing/campaign/sneaker-campaign.webp?inline";
import sourceImage from "../../../../public/landing/campaign/sneaker-source.webp?inline";
import { initializePageScrollbar } from "../../../components/page-scrollbar";
import pageScrollbarStyle from "../../../components/page-scrollbar.css?raw";
import type { Locale } from "../../../i18n/locale";
import studioPalette from "../../../styles/studio-palette.css?raw";
import footerTemplate from "./landing-footer.html?raw";
import { initializeLandingFrameBridge } from "./landing-frame-bridge";
import heroStyles from "./landing-hero.css?raw";
import heroTemplate from "./landing-hero.html?raw";
import motionStyles from "./landing-motion.css?raw";
import landingPalette from "./landing-palette.css?raw";
import { initializeLandingMotion } from "./landing-showcase";
import showcaseStyles from "./landing-showcase.css?raw";
import landingTheme from "./landing-theme.css?raw";

const landingImages: Record<string, string> = {
  shoe: shoeImage,
  source: sourceImage,
  scene: sceneImage,
  set: setImage,
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

/** 将本地图片、配色和滚动脚本内联到隔离首页，并按上下文转义中英文文案。 */
export function renderLandingDocument(
  template: string,
  messages: Record<string, string>,
  locale: Locale,
) {
  return template
    .replace("__LYCOBO_LANDING_APPEARANCE__", () =>
      [studioPalette, landingTheme, landingPalette, motionStyles].join("\n"),
    )
    .replace("__LYCOBO_HERO_STYLE__", () => heroStyles + showcaseStyles)
    .replace("__LYCOBO_HERO__", () => heroTemplate)
    .replace("__LYCOBO_FOOTER__", () => footerTemplate)
    .replaceAll("__LYCOBO_FOOTER_WORDMARK__", () => escapeHtml(footerWordmark))
    .replace(/__LYCOBO_IMAGE_([a-z]+)__/g, (marker, name: string) => landingImages[name] ?? marker)
    .replace("__LYCOBO_MOTION_SCRIPT__", () => `(${initializeLandingMotion.toString()})();`)
    .replace(
      "__LYCOBO_LANDING_FRAME_SCRIPT__",
      () => `(${initializeLandingFrameBridge.toString()})();`,
    )
    .replace("__LYCOBO_SCROLLBAR_STYLE__", () => pageScrollbarStyle)
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

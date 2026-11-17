import sceneImage from "../../../../public/landing/headphones-desktop.webp?inline";
import detailImage from "../../../../public/landing/headphones-detail.webp?inline";
import sourceImage from "../../../../public/landing/headphones-source.webp?inline";
import studioImage from "../../../../public/landing/headphones-studio.webp?inline";
import type { Locale } from "../../../i18n/locale";
import { initializeLandingBrandScroll } from "./landing-brand-scroll";
import { initializeLandingFeatureScroll } from "./landing-feature-scroll";
import heroStyles from "./landing-hero.css?raw";
import heroTemplate from "./landing-hero.html?raw";
import { initializeLandingHeroScroll } from "./landing-hero-scroll";
import { initializeLandingScrollbar } from "./landing-scrollbar";

const hero = heroTemplate
  .replaceAll("__LYCOBO_HERO_SCENE__", sceneImage)
  .replaceAll("__LYCOBO_HERO_STUDIO__", studioImage)
  .replaceAll("__LYCOBO_HERO_DETAIL__", detailImage)
  .replace("__LYCOBO_HERO_SOURCE__", sourceImage);

const htmlEntities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** 按 HTML 与脚本字符串的上下文转义文案，避免文案改变隔离模板的结构。 */
export function renderLandingDocument(
  template: string,
  messages: Record<string, string>,
  locale: Locale,
) {
  return template
    .replace("__LYCOBO_HERO_STYLE__", () => heroStyles)
    .replace("__LYCOBO_HERO__", () => hero)
    .replace(
      "__LYCOBO_HERO_SCROLL_SCRIPT__",
      () => `(${initializeLandingHeroScroll.toString()})();`,
    )
    .replace(
      "__LYCOBO_BRAND_SCROLL_SCRIPT__",
      `window.addEventListener("load", ${initializeLandingBrandScroll.toString()}, { once: true });`,
    )
    .replace(
      "__LYCOBO_FEATURE_SCROLL_SCRIPT__",
      `window.addEventListener("load", ${initializeLandingFeatureScroll.toString()}, { once: true });`,
    )
    .replace("__LYCOBO_SCROLLBAR_SCRIPT__", `(${initializeLandingScrollbar.toString()})();`)
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
      return message.replace(/[&<>"']/g, (character) => htmlEntities[character] ?? character);
    });
}

import drapeImage from "../../../../public/landing/comforter-drape.webp?inline";
import foldedImage from "../../../../public/landing/comforter-folded.webp?inline";
import modelImage from "../../../../public/landing/comforter-lifestyle-model.webp?inline";
import roomImage from "../../../../public/landing/comforter-room.webp?inline";
import setImage from "../../../../public/landing/comforter-set.webp?inline";
import sourceImage from "../../../../public/landing/comforter-source.webp?inline";
import specsEnglish from "../../../../public/landing/comforter-spec-sheet-en.webp?inline";
import specsTallEnglish from "../../../../public/landing/comforter-spec-sheet-en-tall.webp?inline";
import specsChinese from "../../../../public/landing/comforter-spec-sheet-zh.webp?inline";
import specsTallChinese from "../../../../public/landing/comforter-spec-sheet-zh-tall.webp?inline";
import stitchImage from "../../../../public/landing/comforter-stitch.webp?inline";
import studioImage from "../../../../public/landing/comforter-studio.webp?inline";
import type { Locale } from "../../../i18n/locale";
import { initializeLandingBrandScroll } from "./landing-brand-scroll";
import { initializeLandingFeatureScroll } from "./landing-feature-scroll";
import heroStyles from "./landing-hero.css?raw";
import heroTemplate from "./landing-hero.html?raw";
import { initializeLandingHeroScroll } from "./landing-hero-scroll";
import { initializeLandingScrollbar } from "./landing-scrollbar";
import showcaseStyles from "./landing-showcase.css?raw";
import { initializeLandingShowreel } from "./landing-showcase-motion";

const specsImages: Record<Locale, Record<string, string>> = {
  "zh-CN": { wide: specsChinese, tall: specsTallChinese },
  en: { wide: specsEnglish, tall: specsTallEnglish },
};

const heroImages: Record<string, string> = {
  drape: drapeImage,
  folded: foldedImage,
  model: modelImage,
  room: roomImage,
  set: setImage,
  source: sourceImage,
  stitch: stitchImage,
  studio: studioImage,
};

const hero = heroTemplate.replace(/__LYCOBO_HERO_([a-z]+)__/g, (marker, name: string) => {
  return heroImages[name] ?? marker;
});

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
    .replace("__LYCOBO_HERO_STYLE__", () => heroStyles + showcaseStyles)
    .replace("__LYCOBO_HERO__", () => hero)
    .replace(
      /__LYCOBO_SPECS_([a-z]+)__/g,
      (marker, name: string) => specsImages[locale][name] ?? marker,
    )
    .replace(
      "__LYCOBO_HERO_SCROLL_SCRIPT__",
      () => `(${initializeLandingHeroScroll.toString()})();
(${initializeLandingShowreel.toString()})();`,
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

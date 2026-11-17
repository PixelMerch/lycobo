import drapeImage from "../../../../public/landing/comforter-drape.webp?inline";
import foldedImage from "../../../../public/landing/comforter-folded.webp?inline";
import roomImage from "../../../../public/landing/comforter-room.webp?inline";
import setImage from "../../../../public/landing/comforter-set.webp?inline";
import sourceImage from "../../../../public/landing/comforter-source.webp?inline";
import stitchImage from "../../../../public/landing/comforter-stitch.webp?inline";
import studioImage from "../../../../public/landing/comforter-studio.webp?inline";
import blenderSource from "../../../../public/landing/showcase/cream-blender-snapshot.webp?inline";
import blenderResult from "../../../../public/landing/showcase/cream-blender-white.webp?inline";
import fashionSource from "../../../../public/landing/showcase/ivory-jacket-snapshot.webp?inline";
import fashionResult from "../../../../public/landing/showcase/ivory-jacket-white.webp?inline";
import beddingSource from "../../../../public/landing/showcase/sage-bedding-snapshot.webp?inline";
import beddingResult from "../../../../public/landing/showcase/sage-bedding-white.webp?inline";
import type { Locale } from "../../../i18n/locale";
import { initializeLandingBrandScroll } from "./landing-brand-scroll";
import { initializeLandingFeatureScroll } from "./landing-feature-scroll";
import heroStyles from "./landing-hero.css?raw";
import heroTemplate from "./landing-hero.html?raw";
import { initializeLandingHeroScroll } from "./landing-hero-scroll";
import { initializeLandingNavBridge } from "./landing-nav-bridge";
import { initializeLandingScrollbar } from "./landing-scrollbar";
import showcaseStyles from "./landing-showcase.css?raw";

const heroImages: Record<string, string> = {
  beddingresult: beddingResult,
  beddingsource: beddingSource,
  blenderresult: blenderResult,
  blendersource: blenderSource,
  drape: drapeImage,
  fashionresult: fashionResult,
  fashionsource: fashionSource,
  folded: foldedImage,
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
  comparison?: { script: string; css: string },
) {
  return template
    .replace("__LYCOBO_HERO_STYLE__", () => heroStyles + showcaseStyles + (comparison?.css ?? ""))
    .replace("__LYCOBO_HERO__", () => hero)
    .replace(
      "__LYCOBO_BRAND_SCROLL_SCRIPT__",
      `window.addEventListener("load", ${initializeLandingBrandScroll.toString()}, { once: true });
window.addEventListener("load", ${initializeLandingNavBridge.toString()}, { once: true });`,
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
    })
    .replace("__LYCOBO_HERO_SCROLL_SCRIPT__", () => {
      const script = comparison?.script.replace(/<\/script/gi, "<\\/script") ?? "";
      return `(${initializeLandingHeroScroll.toString()})();\n${script}`;
    });
}

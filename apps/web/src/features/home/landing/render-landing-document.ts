import footerSocials from "../../../../public/brand/lycobo-footer-socials.svg?inline";
import footerWordmark from "../../../../public/brand/lycobo-footer-wordmark.svg?inline";
import drapeImage from "../../../../public/landing/comforter-drape.webp?inline";
import foldedImage from "../../../../public/landing/comforter-folded.webp?inline";
import roomImage from "../../../../public/landing/comforter-room.webp?inline";
import setImage from "../../../../public/landing/comforter-set.webp?inline";
import sourceImage from "../../../../public/landing/comforter-source.webp?inline";
import stitchImage from "../../../../public/landing/comforter-stitch.webp?inline";
import studioImage from "../../../../public/landing/comforter-studio.webp?inline";
import throwBedroom from "../../../../public/landing/showcase/mint-throw-bedroom.webp?inline";
import throwSofa from "../../../../public/landing/showcase/mint-throw-sofa.webp?inline";
import throwSource from "../../../../public/landing/showcase/mint-throw-source.webp?inline";
import throwTexture from "../../../../public/landing/showcase/mint-throw-texture.webp?inline";
import { initializePageScrollbar } from "../../../components/page-scrollbar";
import pageScrollbarStyle from "../../../components/page-scrollbar.css?raw";
import type { Locale } from "../../../i18n/locale";
import { localizedPath } from "../../../i18n/locale-path";
import studioPalette from "../../../styles/studio-palette.css?raw";
import footerStyles from "../../site/site-footer.css?raw";
import { siteFooterGroups } from "../../site/site-footer-navigation";
import { initializeLandingFeatureScroll } from "./landing-feature-scroll";
import footerTemplate from "./landing-footer.html?raw";
import { initializeLandingFrameBridge } from "./landing-frame-bridge";
import heroStyles from "./landing-hero.css?raw";
import heroTemplate from "./landing-hero.html?raw";
import { initializeLandingHeroScroll } from "./landing-hero-scroll";
import landingPalette from "./landing-palette.css?raw";
import showcaseStyles from "./landing-showcase.css?raw";
import { initializeLandingShowcaseScroll } from "./landing-showcase-scroll";

const heroImages: Record<string, string> = {
  drape: drapeImage,
  folded: foldedImage,
  room: roomImage,
  set: setImage,
  source: sourceImage,
  stitch: stitchImage,
  studio: studioImage,
  throwbedroom: throwBedroom,
  throwsofa: throwSofa,
  throwsource: throwSource,
  throwtexture: throwTexture,
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
const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (character) => htmlEntities[character] ?? character);

function renderFooterGroups(locale: Locale) {
  return siteFooterGroups(locale)
    .map(({ title, links }) => {
      const items = links.map(({ path, label }) => {
        const href = escapeHtml(localizedPath(path, locale));
        return `<li><a href="${href}" data-landing-path="${escapeHtml(path)}">${escapeHtml(label)}</a></li>`;
      });
      return `<div><h2>${escapeHtml(title)}</h2><ul class="site-footer-links">${items.join("")}</ul></div>`;
    })
    .join("\n");
}

/** 按 HTML 与脚本字符串的上下文转义文案，避免文案改变隔离模板的结构。 */
export function renderLandingDocument(
  template: string,
  messages: Record<string, string>,
  locale: Locale,
) {
  return template
    .replace("__LYCOBO_LANDING_APPEARANCE__", () =>
      [studioPalette, landingPalette, footerStyles].join("\n"),
    )
    .replace("__LYCOBO_HERO_STYLE__", () => heroStyles + showcaseStyles)
    .replace("__LYCOBO_HERO__", () => hero)
    .replace("__LYCOBO_FOOTER__", () => footerTemplate)
    .replaceAll("__LYCOBO_FOOTER_WORDMARK__", () => escapeHtml(footerWordmark))
    .replace("__LYCOBO_FOOTER_SOCIALS__", () => escapeHtml(footerSocials))
    .replace("__LYCOBO_FOOTER_GROUPS__", () => renderFooterGroups(locale))
    .replace(
      "__LYCOBO_HERO_SCROLL_SCRIPT__",
      () => `(${initializeLandingHeroScroll.toString()})();
(${initializeLandingShowcaseScroll.toString()})();`,
    )
    .replace(
      "__LYCOBO_LANDING_FRAME_SCRIPT__",
      () => `(${initializeLandingFrameBridge.toString()})();`,
    )
    .replace(
      "__LYCOBO_FEATURE_SCROLL_SCRIPT__",
      `window.addEventListener("load", ${initializeLandingFeatureScroll.toString()}, { once: true });`,
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

import footerSocials from "../../../../public/brand/lycobo-footer-socials.svg?inline";
import footerWordmark from "../../../../public/brand/lycobo-footer-wordmark.svg?inline";
import throwBedroom from "../../../../public/landing/showcase/mint-throw-bedroom.webp?inline";
import throwSofa from "../../../../public/landing/showcase/mint-throw-sofa.webp?inline";
import throwSource from "../../../../public/landing/showcase/mint-throw-source.webp?inline";
import throwTexture from "../../../../public/landing/showcase/mint-throw-texture.webp?inline";
import citrusResult from "../../../../public/studio/samples/citrus-splash.webp?inline";
import citrusSource from "../../../../public/studio/samples/white-soda.webp?inline";
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
import landingPalette from "./landing-palette.css?raw";
import { initializeLandingShowcase } from "./landing-showcase";
import showcaseStyles from "./landing-showcase.css?raw";

const landingImages: Record<string, string> = {
  citrusresult: citrusResult,
  citrussource: citrusSource,
  throwbedroom: throwBedroom,
  throwsofa: throwSofa,
  throwsource: throwSource,
  throwtexture: throwTexture,
};

const hero = heroTemplate.replace(/__LYCOBO_HERO_([a-z]+)__/g, (marker, name: string) => {
  return landingImages[name] ?? marker;
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
    .replace("__LYCOBO_SHOWCASE_SCRIPT__", () => `(${initializeLandingShowcase.toString()})();`)
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

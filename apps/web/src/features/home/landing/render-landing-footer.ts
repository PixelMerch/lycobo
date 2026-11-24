import type { Locale } from "../../../i18n/locale";
import { localizedPath } from "../../../i18n/locale-path";
import { siteFooterMessages } from "../../site/site-footer-messages";
import { siteFooterFaqPath, siteFooterGroups } from "../../site/site-footer-navigation";

/** 在隔离首页渲染公共页脚，由现有消息桥打开站内链接并定位 FAQ。 */
export function renderLandingFooter(
  locale: Locale,
  wordmark: string,
  escapeHtml: (value: string) => string,
) {
  const t = siteFooterMessages[locale];
  const groups = siteFooterGroups(locale).map(({ title, links }) => {
    const items = links.map(({ path, label }) => {
      const destination =
        path === siteFooterFaqPath
          ? 'href="#faq" data-landing-anchor="faq"'
          : `href="${escapeHtml(localizedPath(path, locale))}" data-landing-path="${escapeHtml(path)}"`;
      return `<li><a ${destination}>${escapeHtml(label)}</a></li>`;
    });
    return `<div class="site-footer-group"><h2>${escapeHtml(title)}</h2><ul>${items.join("")}</ul></div>`;
  });
  const image = `src="${escapeHtml(wordmark)}" width="429" height="108"`;
  return `<footer class="site-footer landing-footer">
    <div class="site-footer-inner">
      <div class="site-footer-identity">
        <img class="site-footer-brand" ${image} alt="Lycobo">
        <p>${escapeHtml(t.copyright(new Date().getFullYear()))}</p>
      </div>
      <nav class="site-footer-groups" aria-label="${escapeHtml(t.navigation)}">${groups.join("")}</nav>
      <div class="site-footer-signature" aria-hidden="true"><img ${image} alt=""></div>
    </div>
  </footer>`;
}

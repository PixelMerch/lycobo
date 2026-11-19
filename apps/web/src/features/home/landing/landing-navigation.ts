import { shellMessages } from "../../../app/shell-messages";
import type { Locale } from "../../../i18n/locale";
import { localizedPath } from "../../../i18n/locale-path";
import { dashboardToolPaths, freeCanvasPath } from "../../../lib/dashboard-paths";
import type { CommerceToolId } from "../../commerce/commerce-tools";
import { inspirationLibraryPath } from "../../inspiration/inspiration-path";
import { workspaceToolCategories } from "../../workspace/workspace-tool-categories";
import { workspaceToolMessages } from "../../workspace/workspace-tool-messages";

const chevron =
  '<svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const desktopLinkClass =
  "flex items-center gap-[5px] whitespace-nowrap px-[8px] xl:px-[12px] rounded-[8px] text-[rgba(255,255,255,0.78)] hover:text-white";
const mobileLinkClass =
  "flex items-center text-[20px] font-semibold text-white py-[18px] px-[8px] border-b border-[rgba(255,255,255,0.07)]";

// 隔离首页内联工作区使用的 Tabler 图标路径。
const toolIconPaths: Record<CommerceToolId, readonly string[]> = {
  create: [
    "M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2",
    "M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0",
  ],
  textile: [
    "M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12",
    "M10 4l4 16",
    "M12 12l-8 2",
  ],
  variation: [
    "M6 21l15 -15l-3 -3l-15 15l3 3",
    "M15 6l3 3",
    "M9 3a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2",
    "M19 13a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2",
  ],
  replica: [
    "M7 9.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667l0 -8.666",
    "M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1",
  ],
};

/** 以共用工作区目录生成隔离首页的桌面和手机导航。 */
export function renderLandingNavigation(locale: Locale, escapeHtml: (text: string) => string) {
  const { navigation } = workspaceToolMessages[locale];
  const link = (path: string) =>
    `href="${localizedPath(path, locale)}" data-landing-path="${path}"`;
  const shortcuts = [
    { path: inspirationLibraryPath, label: navigation.examples },
    { path: freeCanvasPath, label: shellMessages[locale].freeCanvas },
  ];
  const desktopItems = workspaceToolCategories.map(
    ({ label }, index) => `
    <li class="nav-item shrink-0" data-nav-idx="${index}" data-nav-priority="${index}">
      <a href="#" role="button" id="lycobo-nav-trigger-${index}" aria-expanded="false" aria-controls="nav-panel-${index}" class="${desktopLinkClass}">
        ${escapeHtml(navigation[label])}<span class="nav-chevron">${chevron}</span>
      </a>
    </li>`,
  );
  desktopItems.push(
    ...shortcuts.map(({ path, label }, index) => {
      const position = workspaceToolCategories.length + index;
      return `
      <li class="nav-item shrink-0" data-nav-idx="${position}" data-nav-priority="${position}">
        <a ${link(path)} class="${desktopLinkClass}">${escapeHtml(label)}</a>
      </li>`;
    }),
  );
  const panels = workspaceToolCategories.map(
    ({ sections }, index) => `
    <div id="nav-panel-${index}" class="nav-panel lycobo-tools-panel hidden fixed z-[998]">
      <ul aria-labelledby="lycobo-nav-trigger-${index}">
        ${sections
          .flatMap(({ entries }) => [...entries])
          .map(
            ({ tool }) => `
          <li>
            <a ${link(dashboardToolPaths[tool])} class="lycobo-nav-action lycobo-tool-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${toolIconPaths[tool].map((path) => `<path d="${path}"/>`).join("")}</svg>
              ${escapeHtml(navigation.tools[tool])}
            </a>
          </li>`,
          )
          .join("")}
      </ul>
    </div>`,
  );
  const mobileItems = workspaceToolCategories.map(
    ({ label, sections }, index) => `
    <div class="mob-accordion border-b border-[rgba(255,255,255,0.07)]">
      <button type="button" class="mob-acc-trigger flex items-center justify-between w-full text-[20px] font-semibold text-white py-[18px] px-[8px]" aria-expanded="false" aria-controls="lycobo-mobile-tools-${index}">
        ${escapeHtml(navigation[label])}<span class="mob-acc-chevron">${chevron}</span>
      </button>
      <div id="lycobo-mobile-tools-${index}" class="mob-acc-content hidden px-[8px] pb-[12px]">
        ${sections
          .map(
            ({ heading, entries }) => `
          <section>
            <h2 class="lycobo-tools-heading">${escapeHtml(navigation[heading])}</h2>
            ${entries
              .map(
                ({ tool }) => `
              <a ${link(dashboardToolPaths[tool])} class="lycobo-nav-action flex items-center px-[12px] text-white">
                ${escapeHtml(navigation.tools[tool])}
              </a>`,
              )
              .join("")}
          </section>`,
          )
          .join("")}
      </div>
    </div>`,
  );
  mobileItems.push(
    ...shortcuts.map(
      ({ path, label }) => `
    <a ${link(path)} class="${mobileLinkClass}">${escapeHtml(label)}</a>`,
    ),
  );
  return { desktop: desktopItems.join(""), panels: panels.join(""), mobile: mobileItems.join("") };
}

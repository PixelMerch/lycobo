/** 通过宿主打开隔离首页的站内入口，保留当前语言。 */
export function initializeLandingNavBridge() {
  // 原 FAQ 的两个入口带 pricing 标记（桌面导航与手机菜单），其余导航项保持不变。
  const entries = document.querySelectorAll('a[data-pageforge-source="pricing"]');
  entries.forEach((entry) => {
    // 桌面入口带有 FAQ 下拉面板与展开属性，先移除面板，避免悬停仍打开 FAQ。
    const panelId = entry.getAttribute("aria-controls");
    if (panelId) document.getElementById(panelId)?.remove();
    entry.removeAttribute("aria-controls");
    entry.removeAttribute("aria-haspopup");
    entry.removeAttribute("aria-expanded");
    entry.removeAttribute("role");
    entry.removeAttribute("data-pageforge-source");
    entry.setAttribute("href", "#");
    entry.setAttribute("data-landing-path", "/dashboard/free-canvas");
    entry.querySelector(".nav-chevron")?.remove();
    // 复制节点以移除模板脚本已有的下拉监听。
    entry.replaceWith(entry.cloneNode(true));
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const path = event.target.closest("a[data-landing-path]")?.getAttribute("data-landing-path");
    if (!path) return;
    event.preventDefault();
    // 宿主仅接受预先允许的站内路径。
    parent.postMessage({ type: "lycobo:navigate", path }, "*");
  });
}

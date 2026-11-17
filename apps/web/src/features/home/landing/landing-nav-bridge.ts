/**
 * 隔离首页的导航桥接：把模板里原本指向 FAQ 的入口改成自由画布入口，
 * 点击后向宿主页面发送受限的站内路径，由宿主按当前语言跳转。
 */
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
    entry.setAttribute("data-lycobo-free-canvas", "");
    entry.querySelector(".nav-chevron")?.remove();
    // 复制节点以移除模板脚本已有的下拉监听，只保留本次点击行为。
    const clone = entry.cloneNode(true);
    if (!(clone instanceof HTMLAnchorElement)) return;
    entry.replaceWith(clone);
    clone.addEventListener("click", (event) => {
      event.preventDefault();
      // 宿主只接受白名单路径（见 use-landing-language.ts）。
      parent.postMessage({ type: "lycobo:navigate", path: "/free-canvas" }, "*");
    });
  });
}

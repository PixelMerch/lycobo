/** 通过宿主打开隔离首页的站内入口，保留当前语言。 */
export function initializeLandingNavBridge() {
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return;
    const path = event.target.closest("a[data-landing-path]")?.getAttribute("data-landing-path");
    if (!path) return;
    event.preventDefault();
    // 宿主仅接受预先允许的站内路径。
    parent.postMessage({ type: "lycobo:navigate", path }, "*");
  });
}

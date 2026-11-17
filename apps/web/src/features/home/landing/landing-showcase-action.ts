/** 让隔离首页的创作按钮通过宿主进入当前语言工作台。 */
export function initializeLandingShowcaseAction() {
  const action = document.querySelector("[data-showreel-create]");
  action?.addEventListener("click", () => {
    parent.postMessage({ type: "lycobo:open-workspace" }, "*");
  });
}

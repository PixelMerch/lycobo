const moduleScript = 'script[type="module"][src^="/assets/"]';
const recoveredEntry = "lycobo:recovered-app-entry";
const importFailure =
  /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|unable to preload css/i;

/** 分块加载失败且服务端已切换版本时，同一标签页针对旧入口只刷新一次。 */
export async function recoverUpdatedApp(error: unknown, signal: AbortSignal) {
  if (!(error instanceof Error) || !importFailure.test(error.message)) return;
  const entry = document.querySelector(moduleScript)?.getAttribute("src");
  if (!entry) return;
  try {
    if (sessionStorage.getItem(recoveredEntry) === entry) return;
    const response = await fetch(window.location.href, {
      cache: "no-store",
      headers: { Accept: "text/html" },
      signal: AbortSignal.any([signal, AbortSignal.timeout(4000)]),
    });
    if (!response.ok || !response.headers.get("Content-Type")?.includes("text/html")) return;
    const html = new DOMParser().parseFromString(await response.text(), "text/html");
    const updated = html.querySelector(moduleScript)?.getAttribute("src");
    if (signal.aborted || !updated || updated === entry) return;
    // 页面可能同时挂载多次错误边界，重新检查后才记录并刷新当前地址。
    if (sessionStorage.getItem(recoveredEntry) === entry) return;
    sessionStorage.setItem(recoveredEntry, entry);
    window.location.reload();
  } catch {
    // 离线、探测失败或浏览器禁止访问会话存储时，保留手动重新加载入口。
  }
}

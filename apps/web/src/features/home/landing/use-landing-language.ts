import { useEffect, useRef, useState } from "react";

type HeaderFields = Record<"type" | "x" | "y" | "width" | "height" | "scrollY" | "theme", unknown>;

function hasHeaderFields(data: unknown): data is HeaderFields {
  if (!data || typeof data !== "object") return false;
  return ["type", "x", "y", "width", "height", "scrollY", "theme"].every((key) => key in data);
}

/** 校验隔离模板报告的导航位置，拒绝非有限坐标及未知主题。 */
export function readLandingHeader(data: unknown) {
  if (!hasHeaderFields(data) || data.type !== "lycobo:header") return null;
  const { x, y, width, height, scrollY, theme } = data;
  if (typeof x !== "number" || typeof y !== "number" || typeof width !== "number") return null;
  if (typeof height !== "number" || typeof scrollY !== "number") return null;
  if (![x, y, width, height, scrollY].every(Number.isFinite)) return null;
  if (width <= 0 || width > 200 || height <= 0 || height > 100 || scrollY < 0) return null;
  if (theme !== "light" && theme !== "dark") return null;
  return { x, y, width, height, scrollY, theme };
}

type LandingHeader = NonNullable<ReturnType<typeof readLandingHeader>>;

/** 将隔离导航的占位位置同步给宿主菜单，语言切换后恢复模板滚动。 */
export function useLandingLanguage() {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const currentScroll = useRef(0);
  const pendingScroll = useRef<number | null>(null);
  const [anchor, setAnchor] = useState<LandingHeader | null>(null);
  const [dismissVersion, setDismissVersion] = useState(0);

  useEffect(() => {
    function receiveHeader(event: MessageEvent<unknown>) {
      // sandbox 来源为 null，只信任本组件持有的实际窗口。
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return;
      const data = event.data;
      if (data && typeof data === "object" && "type" in data) {
        if (data.type === "lycobo:dismiss-language") {
          setDismissVersion((version) => version + 1);
          return;
        }
      }
      const next = readLandingHeader(data);
      if (!next) return;
      currentScroll.current = next.scrollY;
      // 滚动位置只存 ref，避免每次滚动都重新渲染菜单。
      setAnchor((previous) => {
        if (
          previous?.x === next.x &&
          previous.y === next.y &&
          previous.width === next.width &&
          previous.height === next.height &&
          previous.theme === next.theme
        )
          return previous;
        return next;
      });
    }
    window.addEventListener("message", receiveHeader);
    return () => window.removeEventListener("message", receiveHeader);
  }, []);

  function prepareLanguageChange() {
    pendingScroll.current = currentScroll.current;
  }

  function closeNavigation() {
    frameRef.current?.contentWindow?.postMessage({ type: "lycobo:close-navigation" }, "*");
  }

  function restoreScroll() {
    if (pendingScroll.current === null) return;
    // 只向指定的隔离窗口发送非敏感位置，不扩大 sandbox 权限。
    frameRef.current?.contentWindow?.postMessage(
      { type: "lycobo:restore-scroll", scrollY: pendingScroll.current },
      "*",
    );
    pendingScroll.current = null;
  }

  return {
    frameRef,
    anchor,
    dismissVersion,
    prepareLanguageChange,
    restoreScroll,
    closeNavigation,
  };
}

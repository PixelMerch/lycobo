import { useEffect, useRef, useState } from "react";
import { useAppNavigate } from "../../../i18n/use-localized-navigation";

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

function sameAnchor(previous: LandingHeader | null, next: LandingHeader) {
  return (
    previous?.x === next.x &&
    previous.y === next.y &&
    previous.width === next.width &&
    previous.height === next.height &&
    previous.theme === next.theme
  );
}

function messageType(data: unknown) {
  return data && typeof data === "object" && "type" in data ? data.type : undefined;
}

/** 处理隔离首页的导航消息，并在语言切换后恢复滚动位置。 */
export function useLandingLanguage() {
  const navigate = useAppNavigate();
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
      const type = messageType(data);
      if (type === "lycobo:open-workspace") {
        void navigate("/workspace");
        return;
      }
      if (type === "lycobo:dismiss-language") {
        setDismissVersion((version) => version + 1);
        return;
      }
      const next = readLandingHeader(data);
      if (!next) return;
      currentScroll.current = next.scrollY;
      // 滚动位置只存 ref，避免每次滚动都重新渲染菜单。
      setAnchor((previous) => (sameAnchor(previous, next) ? previous : next));
    }
    window.addEventListener("message", receiveHeader);
    return () => window.removeEventListener("message", receiveHeader);
  }, [navigate]);

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

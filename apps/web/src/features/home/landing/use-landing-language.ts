import { useEffect, useRef, useState } from "react";
import { useAppNavigate } from "../../../i18n/use-localized-navigation";
import { dashboardPath, dashboardToolPaths, freeCanvasPath } from "../../../lib/dashboard-paths";

type HeaderFields = Record<
  "type" | "x" | "y" | "width" | "height" | "scrollY" | "theme" | "menuOpen" | "signedIn",
  unknown
>;

function hasHeaderFields(data: unknown): data is HeaderFields {
  if (!data || typeof data !== "object") return false;
  return ["type", "x", "y", "width", "height", "scrollY", "theme", "menuOpen", "signedIn"].every(
    (key) => key in data,
  );
}

/** 校验隔离模板报告的导航位置，拒绝非有限坐标及未知主题。 */
export function readLandingHeader(data: unknown) {
  if (!hasHeaderFields(data) || data.type !== "lycobo:header") return null;
  const { x, y, width, height, scrollY, theme, menuOpen, signedIn } = data;
  if (typeof x !== "number" || typeof y !== "number" || typeof width !== "number") return null;
  if (typeof height !== "number" || typeof scrollY !== "number") return null;
  if (![x, y, width, height, scrollY].every(Number.isFinite)) return null;
  if (width <= 0 || width > 480 || height <= 0 || height > 100 || scrollY < 0) return null;
  if (theme !== "light" && theme !== "dark") return null;
  if (typeof menuOpen !== "boolean" || typeof signedIn !== "boolean") return null;
  return { x, y, width, height, scrollY, theme, menuOpen, signedIn } as const;
}

type LandingHeader = NonNullable<ReturnType<typeof readLandingHeader>>;

/** 校验隔离首页请求的导航路径，只允许已接通的站内入口。 */
export function readLandingNavigation(data: unknown) {
  if (!data || typeof data !== "object") return null;
  if (!("type" in data) || data.type !== "lycobo:navigate") return null;
  if (!("path" in data)) return null;
  const { path } = data;
  return path === freeCanvasPath || path === dashboardToolPaths.create || path === dashboardPath
    ? path
    : null;
}

function sameAnchor(previous: LandingHeader | null, next: LandingHeader) {
  return (
    previous?.x === next.x &&
    previous.y === next.y &&
    previous.width === next.width &&
    previous.height === next.height &&
    previous.theme === next.theme &&
    previous.menuOpen === next.menuOpen &&
    previous.signedIn === next.signedIn
  );
}

function messageType(data: unknown) {
  return data && typeof data === "object" && "type" in data ? data.type : undefined;
}

/** 按类型分发隔离首页消息；未知或非法内容一律忽略。 */
function handleFrameMessage(
  data: unknown,
  handlers: {
    dismissLanguage: () => void;
    navigate: (path: string) => void;
    updateScroll: (scrollY: number) => void;
    updateAnchor: (anchor: LandingHeader) => void;
  },
) {
  const type = messageType(data);
  if (type === "lycobo:dismiss-language") {
    handlers.dismissLanguage();
    return;
  }
  if (type === "lycobo:navigate") {
    const path = readLandingNavigation(data);
    if (path) handlers.navigate(path);
    return;
  }
  const next = readLandingHeader(data);
  if (!next) return;
  handlers.updateScroll(next.scrollY);
  handlers.updateAnchor(next);
}

/** 同步隔离首页的导航位置、会话布局和语言切换后的滚动位置。 */
export function useLandingLanguage(signedIn: boolean) {
  const navigate = useAppNavigate();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const currentScroll = useRef(0);
  const pendingScroll = useRef<number | null>(null);
  const [anchor, setAnchor] = useState<LandingHeader | null>(null);
  const [dismissVersion, setDismissVersion] = useState(0);

  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage({ type: "lycobo:account-layout", signedIn }, "*");
  }, [signedIn]);

  useEffect(() => {
    function receiveHeader(event: MessageEvent<unknown>) {
      // sandbox 来源为 null，只信任本组件持有的实际窗口。
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return;
      handleFrameMessage(event.data, {
        dismissLanguage: () => setDismissVersion((version) => version + 1),
        navigate: (path) => void navigate(path),
        updateScroll: (scrollY) => {
          // 滚动位置只存 ref，避免每次滚动都重新渲染菜单。
          currentScroll.current = scrollY;
        },
        updateAnchor: (next) => {
          setAnchor((previous) => (sameAnchor(previous, next) ? previous : next));
        },
      });
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

  function syncFrame() {
    // 模板只收到布局标记，身份与余额由宿主直接渲染。
    const frame = frameRef.current?.contentWindow;
    frame?.postMessage({ type: "lycobo:account-layout", signedIn }, "*");
    if (pendingScroll.current === null) return;
    // 只向指定的隔离窗口发送非敏感位置，不扩大 sandbox 权限。
    frame?.postMessage({ type: "lycobo:restore-scroll", scrollY: pendingScroll.current }, "*");
    pendingScroll.current = null;
  }

  return {
    frameRef,
    anchor,
    dismissVersion,
    prepareLanguageChange,
    syncFrame,
    closeNavigation,
  };
}

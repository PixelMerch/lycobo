import { type LoaderFunctionArgs, redirect } from "react-router";
import { parseLocale } from "../i18n/locale";
import { localeFromPath, localizedPath } from "../i18n/locale-path";
import { currentLocale, useLocaleStore } from "../i18n/locale-store";

/** 首次访问先补地址再启动路由，避免先加载无前缀页面再重定向。 */
export function normalizeInitialLocalePath() {
  const { pathname, search, hash } = window.location;
  const path = `${pathname}${search}${hash}`;
  const target = localizedPath(path, localeFromPath(pathname) ?? currentLocale());
  if (target !== path) window.history.replaceState(window.history.state, "", target);
}

function requestPath(request: Request) {
  const url = new URL(request.url);
  // 客户端 loader 的 Request 可能省略片段；首次访问时从当前地址补回定位。
  const hash =
    url.hash ||
    (window.location.pathname === url.pathname && window.location.search === url.search
      ? window.location.hash
      : "");
  return `${url.pathname}${url.search}${hash}`;
}

/** 入口补齐语言，保留原页面、查询参数与定位。 */
export function redirectToLocale(request: Request) {
  const path = requestPath(request);
  const target = localizedPath(path, currentLocale());
  if (path === target) throw new Response("Not found", { status: 404 });
  return redirect(target);
}

/** 既有业务重定向沿用地址中的语言，不依赖存储偏好。 */
export function localizedRedirect(request: Request, target: string) {
  const locale = localeFromPath(new URL(request.url).pathname) ?? currentLocale();
  return redirect(localizedPath(target, locale));
}

/** 参数变化时同步语言，但复用同一套路由组件与实时连接。 */
export function loadRouteLocale({ params, request }: LoaderFunctionArgs) {
  const locale = parseLocale(params.locale);
  if (!locale) return redirectToLocale(request);
  const url = new URL(request.url);
  if (localeFromPath(url.pathname) !== locale) {
    const path = requestPath(request).replace(/^\/[^/?#]+/, `/${locale}`);
    return redirect(path);
  }
  if (currentLocale() !== locale) useLocaleStore.getState().setLocale(locale);
  return null;
}

import { type Locale, parseLocale } from "./locale";

/** 从站内地址的首段读取受支持的语言，不猜测未知前缀。 */
export function localeFromPath(path: string): Locale | null {
  return parseLocale(/^\/([^/?#]+)/.exec(path)?.[1]);
}

/** 业务层继续使用原有路径，移除语言时保留查询参数和定位。 */
export function withoutLocale(path: string): string {
  const locale = localeFromPath(path);
  if (!locale) return path;
  const rest = path.slice(locale.length + 1);
  if (!rest || rest.startsWith("?") || rest.startsWith("#")) return `/${rest}`;
  return rest;
}

/** 为页面地址设置语言；接口、资源、外站和相对地址保持原样。 */
export function localizedPath(path: string, locale: Locale): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  const businessPath = withoutLocale(path);
  if (/^\/(?:api|images|brand|fonts|studio)(?:\/|$)/.test(businessPath)) return businessPath;
  if (businessPath === "/") return `/${locale}`;
  if (businessPath.startsWith("/?") || businessPath.startsWith("/#"))
    return `/${locale}${businessPath.slice(1)}`;
  return `/${locale}${businessPath}`;
}

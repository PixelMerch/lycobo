import { EmptyState, Link } from "@heroui/react";
import { localizedPath } from "../i18n/locale-path";
import { useLocale } from "../i18n/locale-store";
import { useMessages } from "../i18n/messages";
import { shellMessages } from "./shell-messages";

/** 页面加载出错时的整页提示。 */
export function PageUnavailable() {
  const t = useMessages(shellMessages);
  const locale = useLocale();
  return (
    <EmptyState className="empty-state">
      <h1>{t.pageUnavailable}</h1>
      <Link href={localizedPath("/", locale)}>{t.backHome}</Link>
    </EmptyState>
  );
}

/** 地址不存在时的整页提示。 */
export function PageNotFound() {
  const t = useMessages(shellMessages);
  const locale = useLocale();
  return (
    <EmptyState className="empty-state">
      <h1>{t.pageNotFound}</h1>
      <Link href={localizedPath("/", locale)}>{t.backHome}</Link>
    </EmptyState>
  );
}

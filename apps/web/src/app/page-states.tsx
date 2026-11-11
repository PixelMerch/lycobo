import { Button, EmptyState, Link } from "@heroui/react";
import { IconAlertCircle, IconFileOff, IconRefresh } from "@tabler/icons-react";
import { isRouteErrorResponse, useRouteError } from "react-router";
import { UiIcon } from "../components/ui-icon";
import { localizedPath } from "../i18n/locale-path";
import { useLocale } from "../i18n/locale-store";
import { useMessages } from "../i18n/messages";
import { shellMessages } from "./shell-messages";
import "./page-states.css";

function PageStatus({ canReload }: { canReload: boolean }) {
  const t = useMessages(shellMessages);
  const locale = useLocale();
  return (
    <section className="route-status" aria-labelledby="route-status-title">
      <EmptyState className="route-status-card">
        <div className="route-status-icon">
          <UiIcon icon={canReload ? IconAlertCircle : IconFileOff} size="illustration" />
        </div>
        <h1 id="route-status-title">{canReload ? t.pageUnavailable : t.pageNotFound}</h1>
        <p>{canReload ? t.pageUnavailableHint : t.pageNotFoundHint}</p>
        <div className="route-status-actions">
          {canReload && (
            <Button variant="primary" onPress={() => window.location.reload()}>
              <UiIcon icon={IconRefresh} />
              {t.reloadPage}
            </Button>
          )}
          <Link href={localizedPath("/", locale)}>{t.backHome}</Link>
        </div>
      </EmptyState>
    </section>
  );
}

/** 区分地址不存在与页面加载失败，让用户重试当前地址。 */
export function RouteErrorPage() {
  const error = useRouteError();
  return <PageStatus canReload={!(isRouteErrorResponse(error) && error.status === 404)} />;
}

/** 地址不存在时的整页提示。 */
export function PageNotFound() {
  return <PageStatus canReload={false} />;
}

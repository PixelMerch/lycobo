import { Button } from "@heroui/react";
import type { releaseSchema } from "@lycoboai/contracts";
import { IconSparkles, IconX } from "@tabler/icons-react";
import type { Ref } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { useSiteRelease } from "../../realtime/client";
import { notificationsMessages } from "./notifications-messages";

export type Release = ReturnType<typeof releaseSchema.parse>;

/** 展示站点发布服务提供的最新更新，复用实时连接已同步的版本缓存。 */
export function ReleaseNotice({
  detailId,
  onOpen,
  summaryRef,
}: {
  detailId: string | undefined;
  onOpen: (release: Release) => void;
  summaryRef: Ref<HTMLButtonElement>;
}) {
  const updates = useSiteRelease();
  const t = useMessages(notificationsMessages);
  const release = updates.data?.release;
  if (!release)
    return (
      <div className="account-news-empty">
        <span>
          <UiIcon icon={IconSparkles} size="default" />
        </span>
        <h3>{updates.isError ? t.updatesFailed : t.noUpdates}</h3>
        {updates.isError && (
          <Button size="sm" variant="tertiary" onPress={() => void updates.refetch()}>
            {t.retry}
          </Button>
        )}
      </div>
    );
  return (
    <Button
      ref={summaryRef}
      className="account-message account-release-summary"
      variant="ghost"
      aria-label={release.title}
      aria-expanded={!!detailId}
      {...(detailId ? { "aria-controls": detailId } : {})}
      onPress={() => onOpen(release)}
    >
      <span className="account-message-icon">
        <UiIcon icon={IconSparkles} size="small" />
      </span>
      <span className="account-message-content">
        <span className="account-message-heading">
          <strong>{release.title}</strong>
          <span className="account-message-status">{t.version(release.version)}</span>
        </span>
        <span className="account-release-preview">{release.description}</span>
        <span className="account-message-footer">
          <ReleaseTime publishedAt={release.publishedAt} />
        </span>
      </span>
    </Button>
  );
}

/** 显示发布公告全文，保留服务端提供的段落与换行。 */
export function ReleaseDetail({
  id,
  release,
  onClose,
}: {
  id: string;
  release: Release;
  onClose: () => void;
}) {
  const t = useMessages(notificationsMessages);
  return (
    <section
      id={id}
      className="account-news-surface account-release-detail"
      aria-labelledby={`${id}-title`}
    >
      <header className="account-release-header">
        <h3 id={`${id}-title`}>{release.title}</h3>
        <Button
          isIconOnly
          autoFocus
          size="sm"
          variant="ghost"
          aria-label={t.closeUpdate}
          onPress={onClose}
        >
          <UiIcon icon={IconX} size="small" />
        </Button>
      </header>
      <div className="account-release-body">
        <p>{release.description}</p>
        <div className="account-message-footer">
          <span>{t.version(release.version)}</span>
          <ReleaseTime publishedAt={release.publishedAt} />
        </div>
      </div>
    </section>
  );
}

function ReleaseTime({ publishedAt }: { publishedAt: string }) {
  const locale = useLocale();
  return <time dateTime={publishedAt}>{new Date(publishedAt).toLocaleString(locale)}</time>;
}

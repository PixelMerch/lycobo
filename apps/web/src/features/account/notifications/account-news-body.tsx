import { Button } from "@heroui/react";
import { IconBell, IconSparkles } from "@tabler/icons-react";
import { InfiniteLoad } from "../../../components/infinite-load";
import { UiIcon } from "../../../components/ui-icon";
import { useLocale } from "../../../i18n/locale-store";
import { useMessages } from "../../../i18n/messages";
import { useErrorToast } from "../../../lib/error-toast";
import { useNotifications, useReadNotification, useSiteRelease } from "../../realtime/client";
import { notificationsMessages } from "./notifications-messages";

/** 展示站点发布服务提供的最新更新，复用实时连接已同步的版本缓存。 */
export function ReleaseNotice() {
  const updates = useSiteRelease();
  const t = useMessages(notificationsMessages);
  const locale = useLocale();
  const release = updates.data?.release;
  if (!release)
    return (
      <div className="account-news-empty">
        <span>
          <UiIcon icon={IconSparkles} size="illustration" />
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
    <article className="account-message">
      <span className="account-message-icon">
        <UiIcon icon={IconSparkles} />
      </span>
      <div className="account-message-content">
        <div className="account-message-heading">
          <h3>{release.title}</h3>
          <span className="account-message-status">{t.version(release.version)}</span>
        </div>
        <p>{release.description}</p>
        <div className="account-message-footer">
          <time dateTime={release.publishedAt}>
            {new Date(release.publishedAt).toLocaleString(locale)}
          </time>
        </div>
      </div>
    </article>
  );
}

/** 展示真实服务端消息和独立已读状态。 */
export function NotificationBody() {
  const notifications = useNotifications();
  const read = useReadNotification();
  const t = useMessages(notificationsMessages);
  const locale = useLocale();
  useErrorToast(read.error?.message);
  const messages = notifications.data?.pages.flatMap((page) => page.data) ?? [];
  if (!messages.length)
    return (
      <div className="account-news-empty">
        <span>
          <UiIcon icon={IconBell} size="illustration" />
        </span>
        <h3>{notifications.isError ? t.messagesFailed : t.noMessages}</h3>
        <p>{notifications.isPending ? t.signInForMessages : t.messagesEmptyHint}</p>
        {notifications.isError && (
          <Button size="sm" variant="tertiary" onPress={() => void notifications.refetch()}>
            {t.retry}
          </Button>
        )}
      </div>
    );
  return (
    <>
      {messages.map((message) => (
        <article className="account-message" data-unread={!message.read} key={message.id}>
          <span className="account-message-icon">
            <UiIcon icon={IconBell} size="default" />
          </span>
          <div className="account-message-content">
            <div className="account-message-heading">
              <h3>{message.title}</h3>
              <span className="account-message-status">{message.read ? t.read : t.unread}</span>
            </div>
            <p>{message.body}</p>
            <div className="account-message-footer">
              <time dateTime={message.createdAt}>
                {new Date(message.createdAt).toLocaleString(locale)}
              </time>
              {!message.read && (
                <Button
                  size="sm"
                  variant="ghost"
                  isPending={read.isPending}
                  onPress={() => read.mutate(message.id)}
                >
                  {t.markRead}
                </Button>
              )}
            </div>
          </div>
        </article>
      ))}
      <InfiniteLoad
        hasMore={!!notifications.hasNextPage}
        isLoading={notifications.isFetchingNextPage}
        isError={notifications.isError}
        onLoadMore={() => notifications.fetchNextPage()}
      />
      {notifications.isFetchNextPageError && (
        <Button size="sm" variant="tertiary" onPress={() => void notifications.fetchNextPage()}>
          {t.retryMessages}
        </Button>
      )}
    </>
  );
}

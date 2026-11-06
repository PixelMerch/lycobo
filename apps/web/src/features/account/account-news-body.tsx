import { Button, Link } from "@heroui/react";
import { IconBell, IconExternalLink, IconList } from "@tabler/icons-react";
import { InfiniteLoad } from "../../components/infinite-load";
import { UiIcon } from "../../components/ui-icon";
import { useErrorToast } from "../../lib/error-toast";
import { useNotifications, useReadNotification, useSiteRelease } from "../realtime/client";

/** 展示真实服务端消息和独立已读状态，不为消息导航或覆盖草稿。 */
export function NotificationBody() {
  const notifications = useNotifications();
  const read = useReadNotification();
  useErrorToast(read.error?.message);
  const messages = notifications.data?.pages.flatMap((page) => page.data) ?? [];
  if (!messages.length)
    return (
      <div className="account-news-empty">
        <span>
          <UiIcon icon={IconBell} size="illustration" />
        </span>
        <h3>{notifications.isError ? "消息加载失败" : "暂无消息"}</h3>
        <p>{notifications.isPending ? "登录后可查看消息" : "任务结果和系统通知会在这里显示"}</p>
        {notifications.isError && (
          <Button size="sm" variant="tertiary" onPress={() => void notifications.refetch()}>
            重试
          </Button>
        )}
      </div>
    );
  return (
    <>
      {messages.map((message) => (
        <article className="account-release" key={message.id}>
          <span className="account-release-icon">
            <UiIcon icon={IconBell} size="action" />
          </span>
          <div>
            <h3>{message.title}</h3>
            <p>{message.body}</p>
            <p className="account-release-meta">
              <time dateTime={message.createdAt}>
                {new Date(message.createdAt).toLocaleString("zh-CN")}
              </time>
            </p>
            {message.read ? (
              <span>已读</span>
            ) : (
              <Button
                size="sm"
                variant="tertiary"
                isPending={read.isPending}
                onPress={() => read.mutate(message.id)}
              >
                标为已读
              </Button>
            )}
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
          重试加载消息
        </Button>
      )}
    </>
  );
}

/** 只显示已发布摘要；主动刷新前提醒用户保留草稿。 */
export function ReleaseBody() {
  const latest = useSiteRelease();
  const release = latest.data?.release;
  const available = !!release && release.version !== import.meta.env.VITE_APP_RELEASE_VERSION;
  if (!release)
    return (
      <div className="account-news-empty">
        <h3>{latest.isError ? "更新记录加载失败" : "暂无更新记录"}</h3>
      </div>
    );
  return (
    <article className="account-release">
      <span className="account-release-icon">
        <UiIcon icon={IconList} size="action" />
      </span>
      <div>
        <h3>{release.title}</h3>
        <p className="account-release-meta">
          <span>{release.version}</span>
          <time dateTime={release.publishedAt}>{release.publishedAt.slice(0, 10)}</time>
        </p>
        <p>{release.description}</p>
        {available ? (
          <>
            <p>有新版本可用，请先保存未提交内容，再刷新体验。</p>
            <Button size="sm" variant="primary" onPress={() => location.reload()}>
              刷新体验
            </Button>
          </>
        ) : (
          <p>已更新至当前版本</p>
        )}
        <p>
          <Link
            href="https://github.com/PixelMerch/lycobo/releases"
            target="_blank"
            rel="noopener noreferrer"
          >
            查看更新记录 <UiIcon icon={IconExternalLink} size="small" />
          </Link>
        </p>
      </div>
    </article>
  );
}

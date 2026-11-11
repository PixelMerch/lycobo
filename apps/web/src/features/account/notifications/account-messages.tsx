import { Button, Popover, Tabs, Tooltip, toast } from "@heroui/react";
import { IconBell } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { currentMessages, useMessages } from "../../../i18n/messages";
import { useNotifications, useSiteRelease } from "../../realtime/client";
import { NotificationBody, ReleaseNotice } from "./account-news-body";
import { notificationsMessages } from "./notifications-messages";
import "./account-messages.css";

/** 顶部消息入口和版本提醒共用导航下方的消息浮层。 */
export function AccountMessages({ signedIn }: { signedIn: boolean }) {
  const t = useMessages(notificationsMessages);
  const notifications = useNotifications();
  const anchor = useRef<HTMLSpanElement>(null);
  const [section, setSection] = useState<"system" | "updates" | null>(null);
  const release = useSiteRelease().data?.release;
  const announced = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!release) return;
    const { version, publishedAt } = release;
    // 新版部署与公告发布之间，接口仍可能返回上一版公告。
    if (
      version === import.meta.env.VITE_APP_RELEASE_VERSION ||
      version === announced.current ||
      Date.parse(publishedAt) <= import.meta.env.VITE_APP_BUILD_TIME
    )
      return;
    announced.current = version;
    const messages = currentMessages(notificationsMessages);
    const id = toast.info(messages.newVersion, {
      timeout: 10000,
      actionProps: {
        className: "toast-compact-action",
        size: "sm",
        variant: "tertiary",
        children: messages.viewVersion,
        onPress: () => {
          toast.close(id);
          setSection("updates");
        },
      },
    });
  }, [release]);
  const unread = notifications.data?.pages[0]?.unread ?? 0;
  const label = t.messagesLabel(unread);
  return (
    <Popover isOpen={section !== null} onOpenChange={(open) => setSection(open ? "system" : null)}>
      <span ref={anchor} className="account-news-anchor" aria-hidden="true" />
      {signedIn && (
        <Tooltip delay={200}>
          <Button
            isIconOnly
            size="sm"
            variant="tertiary"
            className="account-footer-action"
            aria-label={label}
          >
            <UiIcon icon={IconBell} />
            {unread > 0 && <span className="account-news-dot" aria-hidden="true" />}
          </Button>
          <Tooltip.Content placement="top">{label}</Tooltip.Content>
        </Tooltip>
      )}
      <Popover.Content
        className="account-news-popover"
        triggerRef={anchor}
        placement="bottom end"
        offset={8}
        containerPadding={8}
        shouldFlip={false}
        isNonModal
      >
        <Popover.Dialog className="account-news-panel" aria-label={t.messagesTitle}>
          <Tabs
            key={section ?? "closed"}
            defaultSelectedKey={section ?? "system"}
            className="account-news-tabs"
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label={t.messagesTitle}>
                {signedIn && (
                  <Tabs.Tab
                    id="system"
                    aria-label={
                      unread > 0
                        ? `${t.systemNotifications} · ${t.unreadCount(unread)}`
                        : t.systemNotifications
                    }
                  >
                    {t.systemNotifications}
                    {unread > 0 && (
                      <span className="account-news-count" aria-hidden="true">
                        {unread > 99 ? "99+" : unread}
                      </span>
                    )}
                  </Tabs.Tab>
                )}
                <Tabs.Tab id="updates">{t.updateNotifications}</Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
            {signedIn && (
              <Tabs.Panel id="system" className="account-news-body">
                <NotificationBody />
              </Tabs.Panel>
            )}
            <Tabs.Panel id="updates" className="account-news-body">
              <ReleaseNotice />
            </Tabs.Panel>
          </Tabs>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

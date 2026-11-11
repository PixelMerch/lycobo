import { Button, Popover, Tabs, Tooltip } from "@heroui/react";
import { IconBell } from "@tabler/icons-react";
import { useRef } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import { useNotifications } from "../../realtime/client";
import { NotificationBody, ReleaseNotice } from "./account-news-body";
import { notificationsMessages } from "./notifications-messages";
import "./account-messages.css";

/** 顶部栏消息入口，在导航下方展开独立的消息浮层。 */
export function AccountMessages() {
  const t = useMessages(notificationsMessages);
  const notifications = useNotifications();
  const anchor = useRef<HTMLSpanElement>(null);
  const unread = notifications.data?.pages[0]?.unread ?? 0;
  const label = t.messagesLabel(unread);
  return (
    <Popover>
      <span ref={anchor} className="account-news-anchor" aria-hidden="true" />
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
          <Tabs defaultSelectedKey="system" className="account-news-tabs">
            <Tabs.ListContainer>
              <Tabs.List aria-label={t.messagesTitle}>
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
                <Tabs.Tab id="updates">{t.updateNotifications}</Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
            <Tabs.Panel id="system" className="account-news-body">
              <NotificationBody />
            </Tabs.Panel>
            <Tabs.Panel id="updates" className="account-news-body">
              <ReleaseNotice />
            </Tabs.Panel>
          </Tabs>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

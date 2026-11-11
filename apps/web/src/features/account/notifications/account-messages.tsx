import { Button, Drawer, Tooltip } from "@heroui/react";
import { IconBell, IconX } from "@tabler/icons-react";
import { UiIcon } from "../../../components/ui-icon";
import { useMessages } from "../../../i18n/messages";
import "./account-messages.css";

import { useNotifications } from "../../realtime/client";
import { NotificationBody } from "./account-news-body";
import { notificationsMessages } from "./notifications-messages";

/** 顶部栏与手机导航抽屉共用的消息入口，未读数来自实时服务。 */
export function AccountMessages() {
  const t = useMessages(notificationsMessages);
  const notifications = useNotifications();
  const unread = notifications.data?.pages[0]?.unread ?? 0;
  const label = t.messagesLabel(unread);
  return (
    <Drawer>
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
      <Drawer.Backdrop className="account-news-backdrop">
        <Drawer.Content placement="right" className="account-news-content">
          <Drawer.Dialog className="account-news-panel">
            <Drawer.Header className="account-news-header">
              <div>
                <Drawer.Heading>{t.messagesTitle}</Drawer.Heading>
                <p>{unread > 0 ? t.unreadCount(unread) : t.messagesHint}</p>
              </div>
              <Drawer.CloseTrigger aria-label={t.close(t.messagesTitle)}>
                <UiIcon icon={IconX} size="action" />
              </Drawer.CloseTrigger>
            </Drawer.Header>
            <Drawer.Body className="account-news-body">
              <NotificationBody />
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

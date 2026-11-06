import { Button, Drawer, Link, Tooltip } from "@heroui/react";
import { IconBell, IconExternalLink, IconList, IconX } from "@tabler/icons-react";
import { UiIcon } from "../../components/ui-icon";
import "./account-updates.css";

import { useNotifications, useSiteRelease } from "../realtime/client";
import { NotificationBody, ReleaseBody } from "./account-news-body";

/** 沿用侧栏消息与更新抽屉，未读数与版本状态来自实时服务。 */
export function AccountUpdates({ kind }: { kind: "updates" | "messages" }) {
  const updates = kind === "updates";
  const title = updates ? "最近更新" : "消息中心";
  const notifications = useNotifications();
  const latest = useSiteRelease();
  const newRelease =
    !!latest.data?.release &&
    latest.data.release.version !== import.meta.env.VITE_APP_RELEASE_VERSION;
  const unread = notifications.data?.pages[0]?.unread ?? 0;
  const updateLabel = newRelease ? "更新记录（有新版本）" : "更新记录";
  const label = updates ? updateLabel : `消息（${unread} 条未读）`;
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
          <UiIcon icon={updates ? IconList : IconBell} />
          {(updates ? newRelease : unread > 0) && (
            <span className="account-news-dot" aria-hidden="true" />
          )}
        </Button>
        <Tooltip.Content placement="top">{label}</Tooltip.Content>
      </Tooltip>
      <Drawer.Backdrop className="account-news-backdrop">
        <Drawer.Content placement="right" className="account-news-content">
          <Drawer.Dialog className="account-news-panel">
            <Drawer.Header className="account-news-header">
              <div>
                <Drawer.Heading>{title}</Drawer.Heading>
                {!updates && <p>{unread > 0 ? `${unread} 条未读消息` : "任务进展与系统消息"}</p>}
              </div>
              <Drawer.CloseTrigger aria-label={`关闭${title}`}>
                <UiIcon icon={IconX} size="action" />
              </Drawer.CloseTrigger>
            </Drawer.Header>
            <Drawer.Body className="account-news-body">
              {updates ? <ReleaseBody /> : <NotificationBody />}
            </Drawer.Body>
            {updates && (
              <Drawer.Footer className="account-news-footer">
                <Link
                  href="https://github.com/PixelMerch/lycobo/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  查看全部更新记录 <UiIcon icon={IconExternalLink} size="small" />
                </Link>
              </Drawer.Footer>
            )}
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

import { Button, Popover, Tabs, Tooltip, toast } from "@heroui/react";
import { IconBell } from "@tabler/icons-react";
import { type Ref, useCallback, useEffect, useId, useRef, useState } from "react";
import { UiIcon } from "../../../components/ui-icon";
import { currentMessages, useMessages } from "../../../i18n/messages";
import { useNotifications, useSiteRelease } from "../../realtime/client";
import { NotificationBody } from "./account-news-body";
import { notificationsMessages } from "./notifications-messages";
import { type Release, ReleaseDetail, ReleaseNotice } from "./release-notice";
import "./account-messages.css";

/** 顶部消息入口和版本提醒共用导航下方的消息浮层。 */
export function AccountMessages({ signedIn }: { signedIn: boolean }) {
  const t = useMessages(notificationsMessages);
  const notifications = useNotifications();
  const anchor = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const [section, setSection] = useState<"system" | "updates" | null>(null);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const summary = useRef<HTMLButtonElement>(null);
  const detailId = useId();
  const isOpen = section !== null;
  useEffect(() => {
    if (!isOpen) return;

    // 非模态浮层不会因点击没有焦点的空白处而自动关闭。
    function dismissOnOutsideClick(event: MouseEvent) {
      const path = event.composedPath();
      if (panel.current && path.includes(panel.current)) return;
      if (trigger.current && path.includes(trigger.current)) return;
      setSection(null);
      setSelectedRelease(null);
    }

    document.addEventListener("click", dismissOnOutsideClick, true);
    return () => document.removeEventListener("click", dismissOnOutsideClick, true);
  }, [isOpen]);
  useReleaseAnnouncement(
    useCallback((release) => {
      setSection("updates");
      setSelectedRelease(release);
    }, []),
  );
  const unread = notifications.data?.pages[0]?.unread ?? 0;
  const label = t.messagesLabel(unread);

  function closeDetail() {
    setSelectedRelease(null);
    // 窄屏要先重新显示列表，再把焦点交还给公告摘要。
    requestAnimationFrame(() => summary.current?.focus({ preventScroll: true }));
  }

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={(open) => {
        setSection(open ? "system" : null);
        setSelectedRelease(null);
      }}
    >
      <span ref={anchor} className="account-news-anchor" aria-hidden="true" />
      {signedIn && (
        <Tooltip delay={200}>
          <Button
            ref={trigger}
            isIconOnly
            size="sm"
            variant="tertiary"
            className="account-footer-action"
            aria-label={label}
          >
            <UiIcon icon={IconBell} />
            {unread > 0 && <span className="account-news-dot" aria-hidden="true" />}
          </Button>
          <Tooltip.Content className="account-news-tooltip" placement="top">
            {label}
          </Tooltip.Content>
        </Tooltip>
      )}
      <Popover.Content
        ref={panel}
        className="account-news-popover"
        data-detail-open={!!selectedRelease}
        triggerRef={anchor}
        placement="bottom end"
        offset={8}
        containerPadding={8}
        shouldFlip={false}
        isNonModal
        shouldCloseOnInteractOutside={(element) => !trigger.current?.contains(element)}
      >
        <Popover.Dialog className="account-news-panel" aria-label={t.messagesTitle}>
          {selectedRelease && (
            <ReleaseDetail id={detailId} release={selectedRelease} onClose={closeDetail} />
          )}
          <MessageTabs
            section={section ?? "system"}
            onSection={(next) => {
              setSection(next);
              if (next === "system") setSelectedRelease(null);
            }}
            signedIn={signedIn}
            unread={unread}
            detailId={selectedRelease ? detailId : undefined}
            summary={summary}
            onRelease={setSelectedRelease}
          />
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function MessageTabs({
  section,
  onSection,
  signedIn,
  unread,
  detailId,
  summary,
  onRelease,
}: {
  section: "system" | "updates";
  onSection: (section: "system" | "updates") => void;
  signedIn: boolean;
  unread: number;
  detailId: string | undefined;
  summary: Ref<HTMLButtonElement>;
  onRelease: (release: Release) => void;
}) {
  const t = useMessages(notificationsMessages);
  return (
    <Tabs
      selectedKey={section}
      onSelectionChange={(key) => {
        if (key === "system" || key === "updates") onSection(key);
      }}
      className="account-news-tabs account-news-surface"
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
        <ReleaseNotice detailId={detailId} onOpen={onRelease} summaryRef={summary} />
      </Tabs.Panel>
    </Tabs>
  );
}

function useReleaseAnnouncement(openRelease: (release: Release) => void) {
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
          openRelease(release);
        },
      },
    });
  }, [openRelease, release]);
}

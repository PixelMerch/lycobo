import { Button } from "@heroui/react";
import { IconBell } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { useImageSession } from "../generation/generation-client";
import { desktopNotificationsEnabled, setDesktopNotifications } from "./desktop-notifications";
import { realtimeMessages } from "./realtime-messages";

function permission() {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

/** 只在用户点击时申请桌面通知权限，拒绝后提供浏览器设置说明。 */
export function DesktopNotificationControl() {
  const t = useMessages(realtimeMessages);
  const session = useImageSession().data;
  const scope = session ? `${session.organizationId}:${session.userId}` : "";
  const [enabled, setEnabled] = useState(() => desktopNotificationsEnabled(scope));
  const [access, setAccess] = useState(permission);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const sync = () => {
      setEnabled(desktopNotificationsEnabled(scope));
      setAccess(permission());
    };
    sync();
    window.addEventListener("focus", sync);
    window.addEventListener("storage", sync);
    window.addEventListener("desktop-notification-preference", sync);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("desktop-notification-preference", sync);
    };
  }, [scope]);
  const active = enabled && access === "granted";
  const toggle = async () => {
    if (active) {
      setDesktopNotifications(scope, false);
      setEnabled(false);
      return;
    }
    if (typeof Notification === "undefined") return;
    setPending(true);
    setFailed(false);
    try {
      // 权限申请必须直接来自用户操作，不能放在消息接收或页面加载中。
      const result = await Notification.requestPermission();
      setAccess(result);
      if (result === "granted") {
        const saved = setDesktopNotifications(scope, true);
        setEnabled(saved);
        setFailed(!saved);
      }
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };
  let hint = t.hintDefault;
  if (access === "unsupported") hint = t.hintUnsupported;
  if (access === "denied") hint = t.hintDenied;
  if (failed) hint = t.hintFailed;
  return (
    <section className="notification-preferences" aria-label={t.alerts}>
      <span className="notification-preferences-icon">
        <UiIcon icon={IconBell} size="default" />
      </span>
      <div className="notification-preferences-copy">
        <h3>{t.desktop}</h3>
        <p>{hint}</p>
      </div>
      <Button
        size="sm"
        variant="tertiary"
        isPending={pending}
        isDisabled={!scope || access === "unsupported" || access === "denied"}
        onPress={() => void toggle()}
      >
        {active ? t.turnOff : t.turnOn}
      </Button>
    </section>
  );
}

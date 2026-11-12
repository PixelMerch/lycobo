import { Description, Label, Switch } from "@heroui/react";
import { IconBell } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { UiIcon } from "../../components/ui-icon";
import { useMessages } from "../../i18n/messages";
import { desktopNotificationsEnabled, setDesktopNotifications } from "./desktop-notifications";
import { realtimeMessages } from "./realtime-messages";

function permission() {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

/** 只在用户点击时申请桌面通知权限，拒绝后提供浏览器设置说明。 */
export function DesktopNotificationControl({ scope }: { scope: string }) {
  const t = useMessages(realtimeMessages);
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
  const toggle = async (next: boolean) => {
    setFailed(false);
    if (!next || permission() === "granted") {
      setFailed(!setDesktopNotifications(scope, next));
      return;
    }
    if (typeof Notification === "undefined") return;
    setPending(true);
    try {
      // 权限申请必须直接来自用户操作，不能放在消息接收或页面加载中。
      const result = await Notification.requestPermission();
      setAccess(result);
      if (result === "granted") {
        setFailed(!setDesktopNotifications(scope, true));
      }
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };
  let hint: string | undefined;
  if (access === "unsupported") hint = t.hintUnsupported;
  if (access === "denied") hint = t.hintDenied;
  if (failed) hint = t.hintFailed;
  return (
    <Switch
      size="sm"
      className="account-notification-switch"
      isSelected={active}
      isDisabled={access === "unsupported" || access === "denied"}
      isReadOnly={pending}
      onChange={(next) => void toggle(next)}
    >
      <Switch.Content className="account-menu-row">
        <UiIcon icon={IconBell} size="small" />
        <Label>{t.desktop}</Label>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch.Content>
      {hint && (
        <Description className="account-notification-hint" aria-live="polite">
          {hint}
        </Description>
      )}
    </Switch>
  );
}

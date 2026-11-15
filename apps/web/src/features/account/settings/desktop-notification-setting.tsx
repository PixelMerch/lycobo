import { Switch } from "@heroui/react";
import { useEffect, useState } from "react";
import { useMessages } from "../../../i18n/messages";
import {
  desktopNotificationsEnabled,
  setDesktopNotifications,
} from "../../realtime/desktop-notifications";
import { realtimeMessages } from "../../realtime/realtime-messages";

import { SettingsRow } from "./account-settings-rows";

function permission() {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

/** 只在用户点击时申请桌面通知权限，拒绝后提供浏览器设置说明。 */
export function DesktopNotificationSetting({ scope }: { scope: string }) {
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
  let hint = "";
  if (access === "unsupported") hint = t.hintUnsupported;
  if (access === "denied") hint = t.hintDenied;
  if (failed) hint = t.hintFailed;
  return (
    <SettingsRow
      label={t.desktop}
      hint={hint}
      action={
        <Switch
          size="sm"
          aria-label={t.desktop}
          isSelected={active}
          isDisabled={access === "unsupported" || access === "denied"}
          isReadOnly={pending}
          onChange={(next) => void toggle(next)}
        >
          <Switch.Content className="settings-notification-switch">
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      }
    />
  );
}

import { Button } from "@heroui/react";
import { useEffect, useState } from "react";
import { useImageSession } from "../generation/generation-client";
import { desktopNotificationsEnabled, setDesktopNotifications } from "./desktop-notifications";

function permission() {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

/** 只在用户点击时申请桌面通知权限，拒绝后提供浏览器设置说明。 */
export function DesktopNotificationControl() {
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
  let hint = "开启后，切到其他标签或应用时也能收到生成完成提醒。";
  if (access === "unsupported") hint = "当前浏览器不支持桌面通知，仍可接收标签标题和站内提醒。";
  if (access === "denied") hint = "通知权限已被阻止，请在浏览器的网站设置中允许通知后再开启。";
  if (failed) hint = "未能开启桌面提醒，请检查浏览器权限和存储设置后重试。";
  return (
    <section className="account-release" aria-label="生成完成提醒">
      <div>
        <h3>桌面通知</h3>
        <p>{hint}</p>
        <Button
          size="sm"
          variant="tertiary"
          isPending={pending}
          isDisabled={!scope || access === "unsupported" || access === "denied"}
          onPress={() => void toggle()}
        >
          {active ? "关闭桌面通知" : "开启桌面通知"}
        </Button>
      </div>
    </section>
  );
}

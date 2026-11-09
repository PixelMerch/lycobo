const preferenceKey = "lycobo:desktop-notifications:v1:";

/** 读取本机成员偏好；获得浏览器权限并不代表用户开启了本功能。 */
export function desktopNotificationsEnabled(scope: string) {
  try {
    return localStorage.getItem(preferenceKey + scope) === "true";
  } catch {
    return false;
  }
}

/** 保存用户主动选择，并同步当前页面与其他标签中的开关。 */
export function setDesktopNotifications(scope: string, enabled: boolean) {
  try {
    localStorage.setItem(preferenceKey + scope, String(enabled));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event("desktop-notification-preference"));
  return true;
}

/** 展示无敏感内容的桌面提醒，浏览器拒绝时不影响任务和站内提示。 */
export function showDesktopCompletion(scope: string, id: string, open: () => void) {
  if (
    typeof Notification === "undefined" ||
    Notification.permission !== "granted" ||
    !desktopNotificationsEnabled(scope)
  )
    return;
  try {
    const notice = new Notification("Lycobo · 图片生成完成", {
      body: "点击查看生成结果",
      tag: `lycobo-completion-${scope}-${id}`,
      icon: "/brand/lycobo-product-pilot-mark.svg",
    });
    notice.onclick = () => {
      window.focus();
      open();
      notice.close();
    };
    return notice;
  } catch {
    return;
  }
}

import { toast as heroToast } from "@heroui/react";

/** 共用瞬时提示的自动关闭时间，单位为毫秒。 */
export const toastTimeout = 3000;

function withDefaultTimeout(notify: typeof heroToast.success): typeof heroToast.success {
  return (message, options) => notify(message, { timeout: toastTimeout, ...options });
}

/** 通过 HeroUI 显示应用提示，保留队列、交互和退出生命周期。 */
export const toast = {
  success: withDefaultTimeout(heroToast.success),
  danger: withDefaultTimeout(heroToast.danger),
  warning: withDefaultTimeout(heroToast.warning),
  info: withDefaultTimeout(heroToast.info),
  close: heroToast.close,
};

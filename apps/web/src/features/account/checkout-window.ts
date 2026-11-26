const channelName = (flow: string) => `lycobo.checkout.${flow}`;
const checkoutWindowLifetime = 24 * 60 * 60 * 1000;

function createReturnChannel(flow: string) {
  try {
    return typeof BroadcastChannel === "undefined"
      ? undefined
      : new BroadcastChannel(channelName(flow));
  } catch {
    return undefined;
  }
}

/** 由用户点击时预开支付窗口，断开外部页面到工作台的 opener。 */
export function openCheckoutWindow() {
  const popup = window.open("about:blank", "_blank");
  if (popup) popup.opener = null;
  return popup;
}

/** 即使充值弹层已关闭，原窗口仍可接收本次回跳并通知支付窗口关闭。 */
export function watchCheckoutReturn(flow: string, onReturn: () => void) {
  const channel = createReturnChannel(flow);
  if (!channel) return;
  const expires = window.setTimeout(() => channel.close(), checkoutWindowLifetime);
  channel.onmessage = ({ data }) => {
    if (data !== "returned") return;
    channel.postMessage("received");
    window.clearTimeout(expires);
    channel.close();
    onReturn();
  };
}

/** 只有原窗口确认收到回跳，才关闭当前支付窗口。 */
export function notifyCheckoutReturn(flow: string) {
  const channel = createReturnChannel(flow);
  if (!channel) return;
  channel.onmessage = ({ data }) => {
    if (data === "received") window.close();
  };
  channel.postMessage("returned");
  return () => channel.close();
}

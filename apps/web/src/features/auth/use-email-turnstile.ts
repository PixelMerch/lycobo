import { useEffect, useRef } from "react";

type Turnstile = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "dark";
      size: "flexible" | "compact";
      appearance: "interaction-only";
      callback: (token: string) => void;
      "error-callback": () => void;
      "timeout-callback": () => void;
      "expired-callback": () => void;
    },
  ) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<Turnstile> | undefined;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    const fail = () => {
      window.clearTimeout(timer);
      script.remove();
      reject(new Error("TURNSTILE_LOAD_FAILED"));
    };
    const timer = window.setTimeout(fail, 12000);
    script.onload = () => {
      if (!window.turnstile) return fail();
      window.clearTimeout(timer);
      resolve(window.turnstile);
    };
    script.onerror = fail;
    document.head.append(script);
  }).catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}

/** 仅在用户发码时加载 Turnstile，每次请求使用新的令牌。 */
export function useEmailTurnstile(siteKey: string | undefined) {
  const container = useRef<HTMLDivElement>(null);
  const cancellation = useRef<(() => void) | null>(null);
  useEffect(() => () => cancellation.current?.(), []);
  async function challenge() {
    if (!siteKey) throw new Error("TURNSTILE_NOT_CONFIGURED");
    const api = await loadTurnstile();
    const target = container.current;
    if (!target) throw new Error("TURNSTILE_CONTAINER_MISSING");
    let widget: string | undefined;
    let timer: number | undefined;
    try {
      const size = (target.parentElement?.clientWidth ?? 0) < 300 ? "compact" : "flexible";
      return await new Promise<string>((resolve, reject) => {
        const fail = () => reject(new Error("TURNSTILE_CHALLENGE_FAILED"));
        cancellation.current = fail;
        timer = window.setTimeout(fail, 120000);
        widget = api.render(target, {
          sitekey: siteKey,
          action: "email_login",
          theme: "dark",
          size,
          appearance: "interaction-only",
          callback: resolve,
          "error-callback": fail,
          "timeout-callback": fail,
          "expired-callback": fail,
        });
      });
    } finally {
      cancellation.current = null;
      window.clearTimeout(timer);
      if (widget) api.remove(widget);
    }
  }
  return { container, challenge };
}

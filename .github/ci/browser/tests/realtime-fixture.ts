import type { Page } from "@playwright/test";
import release from "../../../../release.json" with { type: "json" };

/** 浏览器 fixture 只模拟传输，不访问付费模型或生产 DO。 */
export async function mockRealtime(page: Page) {
  const published = { ...release, publishedAt: "2026-11-06T03:00:00.000Z" };
  await page.route("**/api/v1/realtime/release", (route) =>
    route.fulfill({ json: { release: published } }),
  );
  await page.route("**/api/v1/notifications*", (route) =>
    route.fulfill({ json: { data: [], unread: 0, nextCursor: null } }),
  );
  await page.addInitScript((published) => {
    let active = 0,
      total = 0;
    class FixtureWebSocket {
      static OPEN = 1;
      readyState = 1;
      closed = false;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(url: string | URL) {
        active++;
        total++;
        document.documentElement.dataset.wsActive = String(active);
        document.documentElement.dataset.wsTotal = String(total);
        document.documentElement.dataset.wsUrl = String(url);
        window.addEventListener("fixture:realtime", this.receive);
        queueMicrotask(() => {
          if (!this.closed)
            this.frame({
              type: "ready",
              cursor: new URL(url, location.href).searchParams.get("cursor") ?? "0",
              resync: false,
              release: published,
              expiresAt: Date.now() + 86400000,
            });
        });
      }
      frame(data: unknown) {
        this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(data) }));
      }
      receive = (event: Event) => {
        if (!(event instanceof CustomEvent) || this.closed) return;
        const detail = event.detail;
        if (detail.type === "error") {
          this.onerror?.();
          return;
        }
        if (detail.type === "resync") {
          this.frame({
            type: "ready",
            cursor: detail.id ?? "0",
            resync: true,
            release: published,
            expiresAt: Date.now() + 86400000,
          });
          return;
        }
        if (detail.type === "image.updated") {
          this.frame({
            type: "event",
            cursor: detail.id,
            event: { ...detail.data, id: crypto.randomUUID() },
          });
          return;
        }
        this.frame(detail);
      };
      send(value: string) {
        if (value === "ping") this.onmessage?.(new MessageEvent("message", { data: "pong" }));
      }
      close() {
        if (this.closed) return;
        this.closed = true;
        active--;
        document.documentElement.dataset.wsActive = String(active);
        window.removeEventListener("fixture:realtime", this.receive);
      }
    }
    // 保留 Vite HMR 的原生连接，只替换业务推送，避免把开发连接计入用户连接数。
    const sockets = new Proxy(window.WebSocket, {
      construct(target, args) {
        const url = args[0];
        if (
          (typeof url === "string" || url instanceof URL) &&
          new URL(url, location.href).pathname.startsWith("/api/v1/realtime/")
        )
          return new FixtureWebSocket(url);
        return Reflect.construct(target, args);
      },
    });
    Object.defineProperty(window, "WebSocket", { value: sockets });
  }, published);
}

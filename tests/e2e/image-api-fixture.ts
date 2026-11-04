import type { Page } from "@playwright/test";
export const modelNames = [
  "gpt-image-2",
  "gpt-image-2.5",
  "nano-banana-2.1",
  "gemini-3-pro-image-preview",
];
export const modelDisplayNames = ["Image 2", "Image 2.5", "Banana 2.1", "Banana Pro"];
export function apiFixture(data: unknown, status = 200) {
  const success = status >= 200 && status < 300;
  return {
    request_id: crypto.randomUUID(),
    code: success ? 0 : 40002,
    message: success ? "成功" : "企业账号登录服务暂未开放，请稍后再试。",
    data: success ? data : {},
    error: success ? {} : { code: "AUTH_NOT_CONFIGURED" },
  };
}
export async function mockImageApi(page: Page, { signedIn = true } = {}) {
  const userId = crypto.randomUUID(),
    organizationId = crypto.randomUUID();
  // Favorites are server state; the fixture keeps them for the page's lifetime.
  const favorites = new Set<string>();
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith("/api/v1/auth/")) {
      const session = path.endsWith("/session");
      const status = session && signedIn ? 200 : session ? 401 : 503;
      await route.fulfill({
        status,
        json: apiFixture(
          session && signedIn
            ? { userId, organizationId, account: "image-fixture", role: "member" }
            : {},
          status,
        ),
      });
      return;
    }
    let body: object = { userId, organizationId };
    if (path.endsWith("/video-model"))
      body = { enabled: false, resolution: "768p", unitCredits: 100 };
    else if (path.startsWith("/api/v1/video-tasks")) {
      if (route.request().method() !== "GET")
        return route.fulfill({ status: 503, json: apiFixture({}, 503) });
      body = { data: [] };
    } else if (path.endsWith("/image-models"))
      body = {
        enabled: true,
        editsEnabled: true,
        unitCredits: 2,
        models: modelNames.map((id) => ({
          id,
          enabledResolutions: ["1K", "1.5K", "2K", "4K"],
        })),
      };
    else if (path.endsWith("/image-model-logos"))
      body = { models: modelNames.map((id) => ({ id, name: id, logoUrl: null })) };
    else if (path.endsWith("/image-assets") && route.request().method() === "POST")
      body = { id: crypto.randomUUID(), width: 2, height: 2, bytes: 100, mimeType: "image/png" };
    else if (path.endsWith("/latest-edit")) body = { job: null };
    else if (path.endsWith("/image-asset-favorites")) body = { data: [...favorites] };
    else if (path.endsWith("/favorite")) {
      const id = path.split("/").at(-2) ?? "";
      const favorite = route.request().method() === "PUT";
      if (favorite) favorites.add(id);
      else favorites.delete(id);
      body = { favorite };
    } else if (path.endsWith("/wallet")) body = { balance: 200, unitCredits: 2 };
    else if (path.startsWith("/api/v1/wallet/")) body = { data: [] };
    else if (path.endsWith("/image-tasks") || path.endsWith("/image-assets")) body = { data: [] };
    await route.fulfill({ json: apiFixture(body) });
  });
}

/** `enabled` may be a function, read on every capability request, to change it mid-test. */
export async function mockImageEvents(page: Page, enabled: boolean | (() => boolean) = true) {
  await mockImageApi(page);
  await page.route("**/api/v1/image-models", (route) =>
    route.fulfill({
      json: apiFixture({
        enabled: true,
        eventsEnabled: typeof enabled === "function" ? enabled() : enabled,
        editsEnabled: true,
        unitCredits: 1,
        models: modelNames.map((id) => ({ id, enabledResolutions: ["1K", "1.5K"] })),
      }),
    }),
  );
  await page.addInitScript(() => {
    let active = 0,
      total = 0;
    class FixtureEventSource extends EventTarget {
      onerror: ((event: Event) => void) | null = null;
      closed = false;
      constructor(url: string) {
        super();
        active++;
        total++;
        document.documentElement.dataset.sseActive = String(active);
        document.documentElement.dataset.sseTotal = String(total);
        document.documentElement.dataset.sseUrl = url;
        window.addEventListener("fixture:sse", this.receive);
        queueMicrotask(() => {
          if (!this.closed)
            this.dispatchEvent(
              new MessageEvent("ready", {
                data: "{}",
                lastEventId: new URL(url, location.href).searchParams.get("cursor") ?? "0",
              }),
            );
        });
      }
      receive = (event: Event) => {
        if (!(event instanceof CustomEvent) || this.closed) return;
        if (event.detail.type === "error") {
          this.onerror?.(new Event("error"));
          return;
        }
        this.dispatchEvent(
          new MessageEvent(event.detail.type, {
            data: JSON.stringify(event.detail.data ?? {}),
            lastEventId: event.detail.id ?? "",
          }),
        );
      };
      close() {
        if (this.closed) return;
        this.closed = true;
        active--;
        document.documentElement.dataset.sseActive = String(active);
        window.removeEventListener("fixture:sse", this.receive);
      }
    }
    Object.defineProperty(window, "EventSource", { value: FixtureEventSource });
  });
}

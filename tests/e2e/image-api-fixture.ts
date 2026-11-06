import type { Page } from "@playwright/test";
import { mockRealtime } from "./realtime-fixture";
export const modelNames = [
  "gpt-image-2.6",
  "gpt-image-2",
  "gpt-image-2.5",
  "nano-banana-2.1",
  "gemini-3-pro-image-preview",
];
export const modelDisplayNames = ["Image 2.6", "Image 2.5", "Image 2"];
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
  await mockRealtime(page);
}

/** 为实时测试提供模型能力，传输始终使用共享 WebSocket fixture。 */
export async function mockImageEvents(page: Page) {
  await mockImageApi(page);
}

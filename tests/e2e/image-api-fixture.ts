import type { Page } from "@playwright/test";
export const modelNames = [
  "gpt-image-2.5",
  "gpt-image-2.5-flare",
  "gpt-image-2.5-sunburst",
  "gpt-image-2",
  "gpt-image-2-4K",
];
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
export async function mockImageApi(page: Page) {
  const userId = crypto.randomUUID(),
    organizationId = crypto.randomUUID();
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith("/api/v1/auth/")) {
      await route.fulfill({
        status: path.endsWith("/session") ? 401 : 503,
        json: apiFixture({}, path.endsWith("/session") ? 401 : 503),
      });
      return;
    }
    let body: object = { userId, organizationId };
    if (path.endsWith("/image-models"))
      body = {
        enabled: true,
        editsEnabled: true,
        unitCredits: 1,
        models: modelNames.map((id) => ({
          id,
          enabledResolutions: id === "gpt-image-2-4K" ? ["1K", "2K", "4K"] : ["1K"],
        })),
      };
    else if (path.endsWith("/image-tasks") || path.endsWith("/image-assets")) body = { data: [] };
    await route.fulfill({ json: apiFixture(body) });
  });
}

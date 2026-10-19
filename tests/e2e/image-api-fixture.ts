import type { Page } from "@playwright/test";
export const modelNames = [
  "gpt-image-2.5",
  "gpt-image-2.5-flare",
  "gpt-image-2.5-sunburst",
  "gpt-image-2",
  "gpt-image-2-4K",
];
export async function mockImageApi(page: Page) {
  const userId = crypto.randomUUID(),
    organizationId = crypto.randomUUID();
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
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
    await route.fulfill({ json: body });
  });
}

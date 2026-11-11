import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

test("standalone models remain available when the admin catalog is unavailable", async ({
  page,
}) => {
  await mockImageApi(page);
  let catalogRequests = 0;
  await page.route("**/api/v1/image-model-logos", (route) => {
    catalogRequests += 1;
    return route.fulfill({ status: 503 });
  });
  await page.goto("/commerce/create/gpt-image-2.5");
  const select = page.getByRole("button", { name: "创作模型" });
  await expect(select).toContainText("Image 2.5");
  await select.click();
  await expect(page.getByRole("option")).toHaveText(["Image 2.6", "Image 2.5", "Image 2"]);
  await page.getByRole("option", { name: "Image 2.6", exact: true }).click();
  await expect(select).toContainText("Image 2.6");
  await select.click();
  await expect(page.getByRole("option", { name: /Grok|Seedream/ })).toHaveCount(0);
  expect(catalogRequests).toBe(0);
});

for (const { stored, id, name } of [
  {
    stored: "grok-imagine-image-2.0",
    id: "grok-imagine-image-2.0",
    name: "Grok 2",
  },
  { stored: "gpt-image-2.5-sunburst", id: "gpt-image-2.5", name: "Image 2.5" },
]) {
  test(`history and preview use the selector name for ${name}`, async ({ page }) => {
    await mockImageApi(page);
    const job = {
      id: crypto.randomUUID(),
      public_id: "W00000123",
      organization_id: crypto.randomUUID(),
      user_id: crypto.randomUUID(),
      model: stored,
      prompt: "fixture",
      aspect_ratio: "1:1",
      resolution: "1K",
      requested_count: 1,
      status: "succeeded",
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      items: [
        {
          id: crypto.randomUUID(),
          position: 0,
          status: "succeeded",
          output_asset_id: crypto.randomUUID(),
          error_code: null,
          width: 1024,
          height: 1024,
          worker_id: "fixture",
        },
      ],
    };
    await page.route("**/api/v1/image-model-logos", (route) =>
      route.fulfill({ json: apiFixture({ models: [{ id, name, logoUrl: null }] }) }),
    );
    await page.route("**/api/v1/image-models", (route) =>
      route.fulfill({
        json: apiFixture({
          enabled: true,
          editsEnabled: true,
          unitCredits: 2,
          models: [{ id, enabledResolutions: ["1K", "1.5K"] }],
        }),
      }),
    );
    await page.route("**/api/v1/image-tasks*", (route) =>
      route.fulfill({ json: apiFixture({ data: [job] }) }),
    );
    await page.route("**/api/v1/image-assets/**/content*", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="gray"/></svg>',
      }),
    );
    await page.goto("/commerce/create");
    await expect(page.locator(".generation-meta .model-tag")).toHaveText(name);
    await expect(page.locator(".generation-meta .model-tag")).not.toContainText(stored);
    await page.getByRole("button", { name: "预览图片 1", exact: true }).click();
    await expect(page.locator(".image-preview-model")).toHaveText(name);
    await expect(page.locator(".image-preview-model")).not.toContainText(stored);
  });
}

test("model selectors load local logos and retain image-error fallbacks", async ({ page }) => {
  await mockImageApi(page);
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "选择创作模型", exact: true });
  await expect(trigger.locator("img")).toHaveAttribute("src", "/model-logos/openai.svg");
  await page.route("**/model-logos/openai.svg", (route) => route.fulfill({ status: 404 }));
  await page.reload();
  await trigger.click();
  const options = page.locator(".home-model-option");
  await expect(options).toHaveCount(3);
  await expect(options.nth(2).locator(".creation-model-logo-fallback")).toBeVisible();
  await options.nth(1).click();
  await expect(trigger).toContainText("Image 2.5");
});

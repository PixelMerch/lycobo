import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

test("enabled backend models appear in navigation and selectors with independent drafts", async ({
  page,
}) => {
  await mockImageApi(page);
  const models = [
    { id: "gpt-image-2", name: "Image 2", logoUrl: null },
    { id: "custom-image-v7", name: "新增图片模型", logoUrl: null },
  ];
  await page.route("**/api/v1/image-model-logos", (route) =>
    route.fulfill({ json: apiFixture({ models }) }),
  );
  await page.route("**/api/v1/image-models", (route) =>
    route.fulfill({
      json: apiFixture({
        enabled: true,
        editsEnabled: true,
        unitCredits: 20,
        models: models.map(({ id }) => ({ id, enabledResolutions: ["1K", "2K"] })),
      }),
    }),
  );
  await page.goto("/create/custom-image-v7");
  const select = page.getByRole("button", { name: "创作模型" });
  await expect(select).toContainText("新增图片模型");
  await select.click();
  await expect(page.getByRole("option", { name: "新增图片模型", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "nano-banana-2.1", exact: true })).toHaveCount(0);
  await page.getByRole("option", { name: "Image 2", exact: true }).click();
  await expect(select).toContainText("Image 2");
  await page.goto("/");
  await page.getByRole("button", { name: "选择创作模型", exact: true }).click();
  await expect(page.getByRole("button", { name: "新增图片模型", exact: true })).toBeVisible();
});

for (const { stored, id, name } of [
  {
    stored: "model-306bd9de-fb34-4322-8030-21152082cb30",
    id: "model-306bd9de-fb34-4322-8030-21152082cb30",
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
          unitCredits: 20,
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
    await page.goto(`/create/${id}`);
    await expect(page.getByRole("button", { name: "创作模型" })).toContainText(name);
    await expect(page.locator(".generation-meta .model-tag")).toHaveText(name);
    await expect(page.locator(".generation-meta .model-tag")).not.toContainText(stored);
    await page.getByRole("button", { name: "预览图片 1", exact: true }).click();
    await expect(page.locator(".image-preview-model")).toHaveText(name);
    await expect(page.locator(".image-preview-model")).not.toContainText(stored);
  });
}

test("model selectors use backend logos, names and image-error fallbacks", async ({ page }) => {
  await mockImageApi(page);
  const logo = "https://fixture.example/fixtures/catalog-logo.svg";
  const models = [
    { id: "gpt-image-2", name: "Image 2", logoUrl: logo },
    {
      id: "gpt-image-2.5",
      name: "Image 2.5",
      logoUrl: "https://fixture.example/fixtures/missing-logo.png",
    },
    { id: "nano-banana-2.1", name: "Banana 2.1", logoUrl: null },
  ];
  await page.route("**/fixtures/catalog-logo.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="28" fill="#0485f7"/></svg>',
    }),
  );
  await page.route("**/fixtures/missing-logo.png", (route) => route.fulfill({ status: 404 }));
  await page.route("**/api/v1/image-model-logos", (route) =>
    route.fulfill({
      json: apiFixture({ models }),
    }),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "选择创作模型", exact: true });
  await expect(trigger).toContainText("Image 2");
  await expect(trigger.locator("img")).toHaveAttribute("src", logo);
  await trigger.click();
  const options = page.locator(".home-model-option");
  await expect(options).toHaveCount(3);
  await expect(options.nth(0).locator("img")).toHaveAttribute("src", logo);
  await expect(options.nth(1).locator(".creation-model-logo-fallback")).toBeVisible();
  await expect(options.nth(2).locator(".creation-model-logo-fallback")).toBeVisible();
  await options.nth(1).click();
  await expect(trigger).toContainText("Image 2.5");
  await expect(trigger.locator(".creation-model-logo-fallback")).toBeVisible();
  await page
    .getByRole("dialog", { name: "模型和画面设置" })
    .screenshot({ path: "/tmp/lycobo-home-model-logos.png" });
  await page.keyboard.press("Escape");
  await page.goto("/create/gpt-image-2");
  const select = page.getByRole("button", { name: /创作模型/ });
  await expect(select.locator("img")).toHaveAttribute("src", logo);
  await select.click();
  const option = page.getByRole("option", { name: "Image 2", exact: true });
  await expect(option.locator("img")).toHaveAttribute("src", logo);
  await expect(
    page
      .getByRole("option", { name: "Banana 2.1", exact: true })
      .locator(".creation-model-logo-fallback"),
  ).toBeVisible();
  await page.getByRole("option", { name: "Image 2.5", exact: true }).click();
  await expect(select).toContainText("Image 2.5");
  await expect(select.locator(".creation-model-logo-fallback")).toBeVisible();
});

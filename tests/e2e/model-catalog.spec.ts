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

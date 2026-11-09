import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

for (const failure of [false, true]) {
  test(`queued upload ${failure ? "failure preserves the draft without a paid submission" : "waits for the persisted asset before generation"}`, async ({
    page,
  }) => {
    await mockImageApi(page);
    const uploadId = crypto.randomUUID(),
      assetId = crypto.randomUUID();
    let completed = false,
      reads = 0,
      submissions = 0;
    await page.route("**/api/v1/image-assets", async (route) => {
      if (route.request().method() !== "POST")
        return route.fulfill({ json: apiFixture({ data: [] }) });
      await route.fulfill({ status: 202, json: apiFixture({ uploadId }, 202) });
    });
    await page.route(`**/api/v1/image-uploads/${uploadId}`, async (route) => {
      reads++;
      const result = completed
        ? failure
          ? { status: "failed" }
          : { status: "succeeded", asset: { id: assetId } }
        : { status: "pending" };
      await route.fulfill({ json: apiFixture(result) });
    });
    await page.route("**/api/v1/image-tasks", async (route) => {
      if (route.request().method() !== "POST")
        return route.fulfill({ json: apiFixture({ data: [] }) });
      submissions++;
      expect(completed).toBe(true);
      expect(route.request().postDataJSON().referenceAssetIds).toEqual([assetId]);
      await route.fulfill({
        status: 202,
        json: apiFixture({ id: crypto.randomUUID(), replayed: false }, 202),
      });
    });
    await page.goto("/commerce/create");
    await page
      .getByLabel("添加参考图片", { exact: true })
      .setInputFiles("apps/web/public/studio/bedroom.webp");
    const prompt = page.getByLabel(/^(提示词|制作要求)$/, { exact: true });
    await prompt.fill("保留床品质感，生成明亮卧室商品主图");
    await page.getByRole("button", { name: "生成商品主图", exact: true }).click();
    await expect.poll(() => reads).toBeGreaterThan(0);
    expect(submissions).toBe(0);
    completed = true;
    if (failure) {
      await expect(
        page.getByText("参考图处理失败，请重新导出为 PNG、JPEG 或 WebP 后重试。", { exact: true }),
      ).toBeVisible();
      await expect(prompt).toHaveValue("保留床品质感，生成明亮卧室商品主图");
      await expect(page.locator(".reference-tile")).toHaveCount(1);
      expect(submissions).toBe(0);
    } else {
      await expect.poll(() => submissions).toBe(1);
      await expect(page.locator(".reference-tile")).toHaveCount(0);
    }
  });
}

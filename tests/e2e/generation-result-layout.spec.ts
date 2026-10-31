import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

for (const count of [1, 3]) {
  test(`generation results cap single and multiple image widths consistently (${count})`, async ({
    page,
  }) => {
    await mockImageApi(page);
    const job = {
      id: crypto.randomUUID(),
      organization_id: crypto.randomUUID(),
      user_id: crypto.randomUUID(),
      model: "gpt-image-2",
      prompt: "结果布局",
      resolution: "1K",
      aspect_ratio: "2:1",
      requested_count: count,
      status: count === 1 ? "succeeded" : "partially_failed",
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      items: Array.from({ length: count }, (_, position) => ({
        id: crypto.randomUUID(),
        position,
        status: count > 1 && position === count - 1 ? "needs_reconciliation" : "succeeded",
        output_asset_id: count > 1 && position === count - 1 ? null : crypto.randomUUID(),
        error_code: null,
        width: 800,
        height: 400,
        worker_id: null,
      })),
    };
    await page.route("**/api/v1/image-tasks?*", (route) =>
      route.fulfill({ json: apiFixture({ data: [job] }) }),
    );
    await page.route("**/api/v1/image-assets/**/content*", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#ccc"/></svg>',
      }),
    );
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/create");
    const results = page.locator(".generation-results");
    await expect(results).toBeVisible();
    const image = results.locator("img").first();
    await expect
      .poll(() =>
        image.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0),
      )
      .toBe(true);
    const area = await results.boundingBox(),
      first = await image.boundingBox();
    if (!area || !first) throw new Error("Missing result geometry");
    if (count === 1) {
      expect(first.width).toBeLessThanOrEqual(400);
      expect(first.width).toBeGreaterThan(350);
      expect(first.width).toBeLessThan(area.width);
      expect(first.width / first.height).toBeCloseTo(2, 1);
    } else {
      const failed = await results.locator(".generation-placeholder").boundingBox();
      if (!failed) throw new Error("Missing failed result");
      expect(Math.abs(failed.width - first.width)).toBeLessThan(2);
      expect(Math.abs(failed.width - failed.height)).toBeLessThan(2);
      expect(Math.abs(failed.y - first.y)).toBeLessThan(2);
      expect(first.width / first.height).toBeCloseTo(1, 1);
    }
  });
}

import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

for (const [width, height] of [
  [800, 400],
  [450, 800],
  [800, 800],
] as const) {
  for (const count of [1, 3]) {
    test(`generation results cap single and multiple image widths consistently (${count}, ${width}:${height})`, async ({
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
        aspect_ratio: `${width}:${height}`,
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
          width,
          height,
          worker_id: null,
        })),
      };
      await page.route("**/api/v1/image-tasks?*", (route) =>
        route.fulfill({ json: apiFixture({ data: [job] }) }),
      );
      await page.route("**/api/v1/image-assets/**/content*", (route) =>
        route.fulfill({
          contentType: "image/svg+xml",
          body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#ccc"/></svg>`,
        }),
      );
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto("/commerce/create");
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
      expect(first.width / first.height).toBeCloseTo(width / height, 1);
      expect(first.width).toBeLessThanOrEqual(area.width);
      if (count > 1) {
        const failed = await results.locator(".generation-placeholder").boundingBox();
        if (!failed) throw new Error("Missing failed result");
        expect(Math.abs(failed.height - first.height)).toBeLessThan(2);
        expect(failed.width / failed.height).toBeCloseTo(width / height, 1);
        const frames = await results.locator(":scope > div").all();
        expect(await frames[2]?.getAttribute("id")).toBe(`result-${job.items[2]?.id}`);
      }
      if (count === 3 && width === 450) {
        await results.screenshot({ path: "/tmp/lycobo-history-portrait.png" });
      }
      const rail = page.locator(".history-thumbnail").first();
      const railBox = await rail.boundingBox();
      if (!railBox) throw new Error("Missing history thumbnail");
      expect(railBox.width / railBox.height).toBeCloseTo(1, 1);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("radio", { name: "历史记录", exact: true }).click();
      await expect(image).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
      const mobile = await image.boundingBox();
      if (!mobile) throw new Error("Missing mobile image");
      expect(mobile.width / mobile.height).toBeCloseTo(width / height, 1);
    });
  }
}

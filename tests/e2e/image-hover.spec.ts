import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
test("image actions download and toggle favorites; sticky history blocks scrolled content", async ({
  page,
}) => {
  await mockImageApi(page);
  const jobs = Array.from({ length: 3 }, () => ({
    id: crypto.randomUUID(),
    organization_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    model: "gpt-image-2.5",
    prompt: "商品场景图",
    resolution: "1K",
    aspect_ratio: "1:1",
    requested_count: 1,
    status: "succeeded",
    created_at: "2026-10-20T01:00:00.000Z",
    completed_at: "2026-10-20T01:01:00.000Z",
    items: [
      {
        id: crypto.randomUUID(),
        position: 0,
        status: "succeeded",
        output_asset_id: crypto.randomUUID(),
        error_code: null,
        width: 1024,
        height: 1024,
        worker_id: "fixture-worker",
      },
    ],
  }));
  await page.route("**/api/v1/image-tasks*", (route) => route.fulfill({ json: { data: jobs } }));
  await page.route("**/api/v1/image-assets/**/content*", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/create");
  const media = page.locator(".generation-media").first();
  const actions = media.locator(".generation-media-actions");
  await expect(actions).toHaveCSS("opacity", "0");
  await media.hover();
  await expect(actions).toHaveCSS("opacity", "1");
  await media.getByRole("button", { name: "收藏图片", exact: true }).click();
  const favorite = media.getByRole("button", { name: "取消收藏", exact: true });
  await expect(favorite).toHaveAttribute("aria-pressed", "true");
  await favorite.click();
  await expect(media.getByRole("button", { name: "收藏图片", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  const download = page.waitForEvent("download");
  await media.getByRole("button", { name: "下载原图", exact: true }).click();
  expect((await download).suggestedFilename()).toBe(`${jobs[0]?.items[0]?.output_asset_id}.png`);
  await page.mouse.move(0, 0);
  await media.getByRole("button", { name: "收藏图片", exact: true }).focus();
  await expect(actions).toHaveCSS("opacity", "1");
  await page.evaluate(() => window.scrollTo(0, 350));
  const header = await page.locator(".topbar").boundingBox();
  const tabs = await page.locator(".workspace-tabs > .tabs__list").boundingBox();
  expect(header?.y).toBe(0);
  expect(tabs?.y).toBeCloseTo((header?.y ?? 0) + (header?.height ?? 0), 0);
  expect(
    await page.locator(".workspace-tabs > .tabs__list").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(rect.x + rect.width - 10, rect.y + 2));
    }),
  ).toBe(true);
  await page.emulateMedia({ media: "screen" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

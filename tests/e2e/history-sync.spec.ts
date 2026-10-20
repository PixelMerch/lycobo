import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

test.use({ timezoneId: "Asia/Shanghai" });

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
test("history thumbnails locate tasks, track scrolling and keep metadata visible", async ({
  page,
}) => {
  await mockImageApi(page);
  const jobs = Array.from({ length: 3 }, (_, index) => ({
    id: crypto.randomUUID(),
    public_id: `W0000000${index}`,
    organization_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    model: "gpt-image-2.5",
    prompt: `商品任务 ${index + 1}`,
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
  const articles = page.locator(".generation-job");
  await expect(articles).toHaveCount(3);
  await expect(page.getByRole("button", { name: "回到顶部", exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: `查看任务 ${jobs[0]?.id}`, exact: true }),
  ).toHaveAttribute("aria-current", "true");
  const target = page.getByRole("button", { name: `查看任务 ${jobs[1]?.id}`, exact: true });
  await target.click();
  await expect(target).toHaveAttribute("aria-current", "true");
  await expect(articles.nth(1)).toHaveAttribute("data-active", "true");
  await expect.poll(async () => (await articles.nth(1).boundingBox())?.y).toBeLessThan(110);
  const info = articles.nth(1).getByRole("definition");
  await expect(info).toHaveText([
    jobs[1]?.public_id ?? "",
    "2026/10/20 09:00:00",
    "gpt-image-2.5",
    "1:1",
    "1K",
    "1 张",
  ]);
  const backToTop = page.getByRole("button", { name: "回到顶部", exact: true });
  await expect(backToTop).toBeVisible();
  const backBox = await backToTop.boundingBox();
  const regenerateBox = await articles.nth(1).getByLabel("重新生成", { exact: true }).boundingBox();
  expect(backBox?.y).toBeGreaterThan(820);
  expect(
    Math.abs(
      (backBox?.x ?? 0) +
        (backBox?.width ?? 0) / 2 -
        (regenerateBox?.x ?? 0) -
        (regenerateBox?.width ?? 0) / 2,
    ),
  ).toBeLessThan(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await backToTop.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(backToTop).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: `查看任务 ${jobs[0]?.id}`, exact: true }),
  ).toHaveAttribute("aria-current", "true");
  await expect(target).toHaveAttribute("aria-current", "false");
  await expect(page.locator(".history-rail")).toHaveCSS("padding-top", "6px");
  const width = (await target.boundingBox())?.width;
  await target.focus();
  await target.press("Enter");
  await expect(target).toHaveAttribute("aria-current", "true");
  expect((await target.boundingBox())?.width).toBe(width);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

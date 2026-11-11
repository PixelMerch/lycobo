import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

test.use({ timezoneId: "Asia/Shanghai" });

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  "base64",
);

function historyJobs(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: crypto.randomUUID(),
    public_id: `W${index.toString(36).toUpperCase().padStart(8, "0")}`,
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
}

test("history thumbnails locate tasks, track scrolling and keep metadata visible", async ({
  page,
}) => {
  await mockImageApi(page);
  const jobs = historyJobs(3);
  await page.route("**/api/v1/image-tasks*", (route) => route.fulfill({ json: { data: jobs } }));
  await page.route("**/api/v1/image-assets/**/content*", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/commerce/create");
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
  const metadataClearance = () =>
    articles
      .nth(1)
      .locator("header")
      .evaluate((header) => {
        const title = document.querySelector(".workspace-tabs > .tabs__list-container");
        return header.getBoundingClientRect().top - (title?.getBoundingClientRect().bottom ?? 0);
      });
  await expect.poll(metadataClearance).toBeGreaterThanOrEqual(12);
  const info = articles.nth(1).getByRole("definition");
  await expect(info).toHaveText([
    "Image 2.5",
    await page.evaluate((iso) => new Date(iso).toLocaleString("zh-CN"), jobs[1]?.created_at ?? ""),
    jobs[1]?.public_id ?? "",
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
  await expect(page.locator(".history-rail")).toHaveCSS("padding-top", "0px");
  const width = (await target.boundingBox())?.width;
  await target.focus();
  await target.press("Enter");
  await expect(target).toHaveAttribute("aria-current", "true");
  expect((await target.boundingBox())?.width).toBe(width);
  await expect.poll(metadataClearance).toBeGreaterThanOrEqual(12);
  await page.setViewportSize({ width: 390, height: 844 });
  // The resize re-lays out the composer; assert the settled layout, not a frame
  // captured mid-reflow.
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.getByRole("radio", { name: "历史记录", exact: true }).click();
  await expect(page.getByRole("region", { name: "工作区历史记录" })).toBeVisible();
  await expect(page.locator(".history-rail")).toBeHidden();
  await expect(articles).toHaveCount(3);
});

test("generating returns the history and its thumbnail index to the newest task", async ({
  page,
}) => {
  await mockImageApi(page);
  const jobs = historyJobs(14);
  let submissions = 0;
  await page.route("**/api/v1/image-tasks*", (route) => {
    if (route.request().method() !== "POST") return route.fulfill({ json: { data: jobs } });
    submissions++;
    return route.fulfill({ status: 202, json: { id: crypto.randomUUID(), replayed: false } });
  });
  await page.route("**/api/v1/image-assets/**/content*", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/commerce/create");
  const list = page.locator(".history-rail-list");
  await expect(list.locator(".history-thumbnail")).toHaveCount(14);
  await list.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => list.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.getByLabel(/^(提示词|制作要求)$/, { exact: true }).fill("新的商品图");
  await page.getByRole("button", { name: "立即生成", exact: true }).click();
  await expect.poll(() => submissions).toBe(1);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect.poll(() => list.evaluate((node) => node.scrollTop)).toBe(0);
  await expect(list.locator(".history-thumbnail").first()).toHaveAttribute("aria-current", "true");
});

test("the asset entry stays fixed above the scrolling thumbnail list", async ({ page }) => {
  await mockImageApi(page);
  const jobs = historyJobs(14);
  await page.route("**/api/v1/image-tasks*", (route) => route.fulfill({ json: { data: jobs } }));
  await page.route("**/api/v1/image-assets/**/content*", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/commerce/create");
  const list = page.locator(".history-rail-list");
  await expect(list.locator(".history-thumbnail")).toHaveCount(14);
  const entry = page.getByRole("button", { name: "打开素材库", exact: true });
  await expect(entry).toContainText("我的素材");
  // Scroll the thumbnails to the end; only the list moves, never the heading.
  const headingBox = await page.locator(".history-rail-title").boundingBox();
  const listBox = await list.boundingBox();
  await page.mouse.move((listBox?.x ?? 0) + 20, (listBox?.y ?? 0) + 200);
  await page.mouse.wheel(0, 6000);
  await expect.poll(() => list.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  await expect(entry).toBeInViewport();
  expect(await page.locator(".history-rail-title").boundingBox()).toEqual(headingBox);
  // Leaving the workspace and returning to the top must not clip the heading
  // or leave it scrolled out of the rail.
  await page.mouse.move(700, 400);
  await page.mouse.wheel(0, 8000);
  await page.mouse.wheel(0, -12000);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  expect(await page.locator(".history-rail-title").boundingBox()).toEqual(headingBox);
  const clearance = await page.evaluate(() => {
    const rail = document.querySelector(".history-rail")?.getBoundingClientRect();
    const title = document.querySelector(".history-rail-title")?.getBoundingClientRect();
    return title && rail ? title.top - rail.top : -1;
  });
  expect(clearance).toBeGreaterThanOrEqual(0);
  await expect(entry).toBeVisible();
});

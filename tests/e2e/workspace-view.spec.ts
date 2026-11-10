import { expect, type Page, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  "base64",
);

/** 两条任务：刚生成的单张图和两天前的四张图；图框尺寸只取决于任务记录里的宽高。 */
async function workspaceFixture(page: Page) {
  await mockImageApi(page);
  const now = new Date();
  const earlier = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2, 12);
  const job = (createdAt: Date, count: number) => {
    const input = {
      model: "gpt-image-2.5",
      prompt: "保留商品外形和面料纹理，更换为自然采光的卧室，不添加文字。",
      aspectRatio: "1:1",
      resolution: "1K",
      count,
      referenceAssetIds: [],
    };
    return {
      id: crypto.randomUUID(),
      organization_id: crypto.randomUUID(),
      user_id: crypto.randomUUID(),
      model: input.model,
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio,
      resolution: input.resolution,
      requested_count: count,
      created_at: createdAt.toISOString(),
      completed_at: createdAt.toISOString(),
      status: "succeeded",
      input,
      items: Array.from({ length: count }, (_, position) => ({
        id: crypto.randomUUID(),
        position,
        status: "succeeded",
        output_asset_id: crypto.randomUUID(),
        error_code: null,
        width: 1024,
        height: 1024,
        worker_id: "fixture-worker",
      })),
    };
  };
  const jobs = [job(now, 1), job(earlier, 4)];
  await page.route("**/api/v1/image-tasks*", (route) =>
    route.fulfill({ json: apiFixture({ data: jobs }) }),
  );
  await page.route("**/api/v1/image-assets/**/content*", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
}

const frameTops = (page: Page, card: number) =>
  page
    .locator(".generation-job")
    .nth(card)
    .locator(".generation-results > div")
    .evaluateAll((frames) => frames.map((frame) => Math.round(frame.getBoundingClientRect().top)));

test("wide screens place task details beside larger results and group the rail by day", async ({
  page,
}) => {
  await workspaceFixture(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/commerce/create");
  const first = page.locator(".generation-job").first();
  await expect(page.locator(".generation-job")).toHaveCount(2);
  const info = await first.locator(".history-task-info").boundingBox();
  const result = await first.locator(".generation-results > div").first().boundingBox();
  if (!info || !result) throw new Error("History card geometry missing");
  // 信息组在左侧 320px 列，单张结果放大到 480px，四张图排满同一行。
  expect(info.width).toBe(320);
  expect(info.x + info.width).toBeLessThan(result.x);
  expect(result.height).toBeCloseTo(480, 0);
  expect(new Set(await frameTops(page, 1)).size).toBe(1);
  const days = page.locator(".history-rail-day");
  await expect(days).toHaveCount(2);
  await expect(days.first()).toHaveText("今天");
  // 紧凑视图把行高降到 240px，刷新后保持。
  await page
    .getByRole("radiogroup", { name: "历史视图", exact: true })
    .getByRole("radio", { name: "紧凑", exact: true })
    .click();
  await expect(page.locator(".unified-workspace")).toHaveAttribute("data-density", "compact");
  await page.reload();
  const compact = await first.locator(".generation-results > div").first().boundingBox();
  expect(compact?.height).toBeCloseTo(240, 0);
});

test("the settings panel collapses to a strip and reopens for editing or a new visit", async ({
  page,
}) => {
  await workspaceFixture(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/commerce/create");
  const composer = page.locator(".composer-panel");
  await expect(composer).toBeVisible();
  await page.getByRole("button", { name: "收起参数栏", exact: true }).click();
  await expect(composer).toBeHidden();
  const strip = page.getByRole("button", { name: "展开参数栏", exact: true });
  await expect(strip).toHaveAttribute("aria-expanded", "false");
  await expect(strip).toBeFocused();
  expect((await strip.boundingBox())?.width).toBe(56);
  // 刷新保持收起；重新编辑会把输入带回参数栏，所以先展开。
  await page.reload();
  await expect(composer).toBeHidden();
  await page.getByRole("button", { name: "重新编辑", exact: true }).first().click();
  await expect(composer).toBeVisible();
  // 从别的页面点进工作台时也展开，让用户先看到草稿。
  await page.getByRole("button", { name: "收起参数栏", exact: true }).click();
  await expect(composer).toBeHidden();
  const navigation = page.getByRole("navigation", { name: "主导航", exact: true });
  await navigation.getByRole("link", { name: "首页", exact: true }).click();
  await navigation.getByRole("button", { name: "电商", exact: true }).hover();
  await page
    .getByRole("menu", { name: "电商" })
    .getByRole("menuitem", { name: "主图制作", exact: true })
    .click();
  await expect(composer).toBeVisible();
});

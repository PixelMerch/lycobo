import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

const sourceId = "a5587123-0000-4000-8000-000000000001";
const jobId = "a5587123-0000-4000-8000-000000000002";
const outputId = "a5587123-0000-4000-8000-000000000003";
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#ddd"/></svg>';

test("multiple repair regions retain original coordinates, submit one image and preserve the original", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.route("**/api/v1/image-assets?*", (route) =>
    route.fulfill({
      json: apiFixture({
        data: [
          {
            id: sourceId,
            public_id: "P00000001",
            kind: "output",
            width: 1024,
            height: 1024,
            bytes: 1024,
            created_at: "2026-10-21T01:00:00.000Z",
            model: "gpt-image-2",
            prompt: "原始商品图",
          },
        ],
      }),
    }),
  );
  await page.route("**/api/v1/image-assets/**/content*", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: svg }),
  );
  let submitted: Record<string, unknown> | undefined;
  let attempts = 0;
  let firstKey: string | undefined;
  await page.route("**/api/v1/image-tasks", async (route) => {
    if (route.request().method() !== "POST")
      return route.fulfill({ json: apiFixture({ data: [] }) });
    const input = route.request().postDataJSON();
    attempts++;
    if (attempts === 1) {
      submitted = input;
      firstKey = route.request().headers()["idempotency-key"];
      return route.abort("failed");
    }
    expect(input).toEqual(submitted);
    expect(route.request().headers()["idempotency-key"]).toBe(firstKey);
    return route.fulfill({ status: 202, json: apiFixture({ id: jobId, replayed: true }) });
  });
  await page.route(`**/api/v1/image-tasks/${jobId}`, (route) =>
    route.fulfill({
      json: apiFixture({
        id: jobId,
        public_id: "WREPAIR01",
        organization_id: crypto.randomUUID(),
        user_id: crypto.randomUUID(),
        model: "gpt-image-2",
        prompt: "局部修改版",
        resolution: "1K",
        aspect_ratio: "1:1",
        requested_count: 1,
        status: "succeeded",
        created_at: "2026-10-21T01:00:00.000Z",
        completed_at: "2026-10-21T01:01:00.000Z",
        items: [
          {
            id: crypto.randomUUID(),
            position: 0,
            status: "succeeded",
            output_asset_id: outputId,
            output_public_id: "P00000002",
            error_code: null,
            width: 1024,
            height: 1024,
            worker_id: "fixture",
          },
        ],
      }),
    }),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/create");
  await page.getByRole("button", { name: "打开素材库", exact: true }).click();
  await page.getByRole("button", { name: "查看图片：原始商品图", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "图片预览", exact: true });
  await viewer.getByRole("button", { name: "局部编辑", exact: true }).click();
  const canvas = viewer.getByRole("region", { name: "局部编辑画布", exact: true });
  await expect(canvas.locator("canvas").first()).toBeVisible();
  // No region and no description yet: the submit action stays disabled instead
  // of reporting a validation error after a click.
  const generateButton = viewer.getByRole("button", { name: "立即生成", exact: true });
  await expect(generateButton).toBeDisabled();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Repair canvas has no bounds");
  await expect(viewer.locator(".image-preview")).toHaveCSS("transform", "none");
  const imageBounds = await viewer.locator(".image-preview-image").boundingBox();
  if (!imageBounds) throw new Error("Source image has no bounds");
  const edge = imageBounds.width;
  const origin = { x: imageBounds.x, y: imageBounds.y };
  await page.mouse.move(origin.x + edge * 0.1, origin.y + edge * 0.1);
  await page.mouse.down();
  await page.mouse.move(origin.x + edge * 0.4, origin.y + edge * 0.3, { steps: 8 });
  await page.mouse.up();
  await viewer
    .getByRole("textbox", { name: "区域 1 修改说明", exact: true })
    .fill("将标题改成柔软舒适");
  // Resize the right-middle handle; the coordinates remain in original pixels.
  await page.mouse.move(origin.x + edge * 0.4, origin.y + edge * 0.2);
  await page.mouse.down();
  await page.mouse.move(origin.x + edge * 0.5, origin.y + edge * 0.2, { steps: 6 });
  await page.mouse.up();
  await expect(viewer.getByRole("spinbutton")).toHaveCount(0);
  await canvas.hover();
  await page.mouse.wheel(0, -200);
  await expect(viewer.getByLabel("画布缩放比例")).toHaveText("115%");
  await viewer.getByRole("button", { name: "添加区域", exact: true }).click();
  await viewer.getByRole("textbox", { name: "区域 2 修改说明", exact: true }).fill("去掉脚袋");
  await viewer.getByRole("button", { name: "返回详情", exact: true }).click();
  await viewer.getByRole("button", { name: "关闭图片预览", exact: true }).click();
  await page.getByRole("button", { name: "查看图片：原始商品图", exact: true }).click();
  await viewer.getByRole("button", { name: "局部编辑", exact: true }).click();
  await expect(viewer.getByRole("textbox", { name: "区域 2 修改说明", exact: true })).toHaveValue(
    "去掉脚袋",
  );
  await viewer.getByRole("button", { name: "区域 2", exact: true }).click();
  await page.screenshot({ path: "/tmp/lycobo-local-repair-desktop.png" });
  await expect(generateButton).toBeEnabled();
  await generateButton.click();
  await expect(viewer.getByRole("button", { name: "确认上次提交", exact: true })).toBeVisible();
  expect(submitted).toMatchObject({
    count: 1,
    referenceAssetIds: [sourceId],
    resolution: "1K",
    aspectRatio: "1:1",
  });
  expect(submitted?.prompt).toContain("将标题改成柔软舒适");
  expect(submitted?.prompt).toContain("区域 2：");
  const firstRegion = String(submitted?.prompt).match(
    /区域 1：左上角 \((\d+), (\d+)\)，宽 (\d+)，高 (\d+)/,
  );
  if (!firstRegion) throw new Error("Missing submitted region coordinates");
  expect(Math.abs(Number(firstRegion[1]) - 102)).toBeLessThan(3);
  expect(Math.abs(Number(firstRegion[2]) - 102)).toBeLessThan(3);
  expect(Math.abs(Number(firstRegion[3]) - 410)).toBeLessThan(4);
  expect(Math.abs(Number(firstRegion[4]) - 205)).toBeLessThan(4);
  expect(submitted?.prompt).toContain("区域 2：左上角 (307, 307)，宽 307，高 307");
  await viewer.getByRole("button", { name: "确认上次提交", exact: true }).click();
  await viewer.getByRole("button", { name: "查看修改版", exact: true }).click();
  await expect(viewer).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "资产管理", exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/create\\?task=${jobId}$`));
  const record = page.locator(`#job-${jobId}`);
  await expect(record).toBeVisible();
  await expect(record).toContainText("WREPAIR01");
  const top = await record.evaluate((node) => node.getBoundingClientRect().top);
  expect(top).toBeGreaterThanOrEqual(60);
  expect(top).toBeLessThan(180);
  expect(attempts).toBe(2);
});

test("repair regions remain usable on a narrow screen", async ({ page }) => {
  await mockImageApi(page);
  await page.route("**/api/v1/image-assets?*", (route) =>
    route.fulfill({
      json: apiFixture({
        data: [
          {
            id: sourceId,
            public_id: "P00000001",
            kind: "output",
            width: 1024,
            height: 1024,
            bytes: 1024,
            created_at: "2026-10-21T01:00:00.000Z",
            model: "gpt-image-2",
            prompt: "原始商品图",
          },
        ],
      }),
    }),
  );
  await page.route("**/api/v1/image-assets/**/content*", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: svg }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/create");
  await page.getByRole("button", { name: "打开素材库", exact: true }).click();
  await page.getByRole("button", { name: "查看图片：原始商品图", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "图片预览", exact: true });
  await viewer.getByRole("button", { name: "局部编辑", exact: true }).click();
  await viewer.getByRole("button", { name: "添加区域", exact: true }).click();
  await viewer.getByRole("textbox", { name: "区域 1 修改说明", exact: true }).fill("修改局部颜色");
  await viewer.getByRole("button", { name: "删除区域 1", exact: true }).click();
  await expect(viewer.getByRole("textbox", { name: "区域 1 修改说明", exact: true })).toHaveCount(
    0,
  );
  expect(await viewer.evaluate((element) => element.scrollWidth <= window.innerWidth)).toBe(true);
});

test("closing with unsubmitted regions asks first and then clears the draft", async ({ page }) => {
  await mockImageApi(page);
  await page.route("**/api/v1/image-assets?*", (route) =>
    route.fulfill({
      json: apiFixture({
        data: [
          {
            id: sourceId,
            public_id: "P00000001",
            kind: "output",
            width: 1024,
            height: 1024,
            bytes: 1024,
            created_at: "2026-10-21T01:00:00.000Z",
            model: "gpt-image-2",
            prompt: "原始商品图",
          },
        ],
      }),
    }),
  );
  await page.route("**/api/v1/image-assets/**/content*", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: svg }),
  );
  await page.route("**/api/v1/image-tasks", (route) =>
    route.fulfill({ json: apiFixture({ data: [] }) }),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/create");
  await page.getByRole("button", { name: "打开素材库", exact: true }).click();
  await page.getByRole("button", { name: "查看图片：原始商品图", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "图片预览", exact: true });
  await viewer.getByRole("button", { name: "局部编辑", exact: true }).click();
  await viewer.getByRole("button", { name: "添加区域", exact: true }).click();
  const prompt = viewer.getByRole("textbox", { name: "区域 1 修改说明", exact: true });
  await prompt.fill("背景换成浅灰");
  const exit = page.getByRole("dialog", { name: "退出局部编辑？", exact: true });

  // Escape asks before discarding the unsubmitted region.
  await page.keyboard.press("Escape");
  await expect(exit).toBeVisible();
  await expect(exit).toContainText("不会保存");
  await expect(viewer).toBeVisible();
  await exit.getByRole("button", { name: "取消", exact: true }).click();
  await expect(exit).toHaveCount(0);
  await expect(prompt).toHaveValue("背景换成浅灰");

  // The corner close action asks too, and confirming ends the viewer.
  await viewer.getByRole("button", { name: "关闭图片预览", exact: true }).click();
  await expect(exit).toBeVisible();
  await exit.getByRole("button", { name: "确认", exact: true }).click();
  await expect(viewer).toHaveCount(0);

  // Reopening starts from an empty edit session.
  await page.getByRole("button", { name: "查看图片：原始商品图", exact: true }).click();
  await viewer.getByRole("button", { name: "局部编辑", exact: true }).click();
  await expect(viewer.getByRole("textbox", { name: "区域 1 修改说明", exact: true })).toHaveCount(
    0,
  );
  await expect(viewer.getByRole("button", { name: "立即生成", exact: true })).toBeDisabled();
});

import { expect, type Page, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

async function references(page: Page, count = 2) {
  await mockImageApi(page);
  const ids = Array.from({ length: count }, () => crypto.randomUUID());
  const job = {
    id: crypto.randomUUID(),
    organization_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    model: "gpt-image-2",
    prompt: "参考商品图片",
    resolution: "1K",
    aspect_ratio: "1:1",
    requested_count: 1,
    created_at: "2026-10-21T01:00:00.000Z",
    completed_at: "2026-10-21T01:01:00.000Z",
    status: "succeeded",
    input: {
      model: "gpt-image-2",
      prompt: "参考商品图片",
      resolution: "1K",
      aspectRatio: "1:1",
      count: 1,
      referenceAssetIds: ids,
    },
    items: [
      {
        id: crypto.randomUUID(),
        position: 0,
        status: "succeeded",
        output_asset_id: crypto.randomUUID(),
        error_code: null,
        width: 1200,
        height: 900,
        worker_id: "fixture",
      },
    ],
  };
  await page.route("**/api/v1/image-tasks*", (route) =>
    route.fulfill({ json: apiFixture({ data: [job] }) }),
  );
  await page.route("**/api/v1/image-assets/**/content*", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#e3d4bc"/></svg>',
    }),
  );
  await page.goto("/create");
  return ids;
}

test("history references share a viewer with switching, rotation, wheel zoom and focus restoration", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const ids = await references(page, 3);
  const trigger = page.getByRole("button", { name: "查看参考图片 2", exact: true });
  await trigger.click();
  const viewer = page.getByRole("dialog", { name: "图片浏览", exact: true });
  const picture = viewer.locator(".browse-image-picture");
  await expect(picture).toHaveAttribute("src", `/api/v1/image-assets/${ids[1]}/content`);
  await expect(picture).toHaveJSProperty("naturalWidth", 1200);
  await expect(viewer.getByLabel("图片缩放比例")).toHaveText("100%");
  await expect(viewer.locator(".browse-image-surface")).toHaveCSS("transform", "none");
  await expect
    .poll(async () => (await viewer.locator(".browse-image-frame").boundingBox())?.width ?? 0)
    .toBeGreaterThan(500);
  const frame = await viewer.locator(".browse-image-frame").boundingBox();
  const close = await viewer
    .getByRole("button", { name: "关闭图片浏览", exact: true })
    .boundingBox();
  if (!frame || !close) throw new Error("Missing image viewer geometry");
  expect(Math.abs(frame.y - close.y)).toBeLessThan(1);
  expect(close.x - frame.x - frame.width).toBeCloseTo(32, 0);
  const next = await viewer.getByRole("button", { name: "下一张图片", exact: true }).boundingBox();
  const prev = await viewer.getByRole("button", { name: "上一张图片", exact: true }).boundingBox();
  if (!next || !prev) throw new Error("Missing image navigation geometry");
  expect(next.x).toBeCloseTo(close.x, 0);
  expect(frame.x - prev.x - prev.width).toBeCloseTo(32, 0);
  const toolbar = viewer.getByRole("toolbar", { name: "图片浏览工具" });
  await expect(toolbar).not.toContainText("/");
  await expect(viewer.getByLabel("图片缩放比例")).toHaveCSS("color", "rgb(255, 255, 255)");
  await picture.click();
  await expect(viewer).toBeVisible();
  await viewer.getByRole("button", { name: "向左旋转", exact: true }).click();
  await expect(picture).toHaveCSS("rotate", "-90deg");
  await viewer.getByRole("button", { name: "向右旋转", exact: true }).click();
  await expect(picture).toHaveCSS("rotate", "0deg");
  await viewer.getByRole("button", { name: "放大图片", exact: true }).click();
  await expect(viewer.getByLabel("图片缩放比例")).toHaveText("125%");
  await viewer.getByRole("button", { name: "缩小图片", exact: true }).click();
  await viewer.getByRole("region", { name: "浏览图片区域", exact: true }).hover();
  await page.mouse.wheel(0, -100);
  await expect(viewer.getByLabel("图片缩放比例")).toHaveText("110%");
  await page.mouse.wheel(0, 100);
  await expect(viewer.getByLabel("图片缩放比例")).toHaveText("100%");
  await viewer.getByRole("button", { name: "上一张图片", exact: true }).click();
  await expect(picture).toHaveAttribute("src", `/api/v1/image-assets/${ids[0]}/content`);
  await expect(viewer.getByLabel("图片缩放比例")).toHaveText("100%");
  await viewer.getByRole("button", { name: "下一张图片", exact: true }).click();
  await expect(picture).toHaveAttribute("src", `/api/v1/image-assets/${ids[1]}/content`);
  await viewer.getByRole("button", { name: "关闭图片浏览", exact: true }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(picture).toHaveAttribute("src", `/api/v1/image-assets/${ids[0]}/content`);
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await expect(trigger).toBeFocused();
  // Virtual activation also restores the precise reference opener.
  await trigger.dispatchEvent("click");
  await viewer.getByRole("button", { name: "关闭图片浏览", exact: true }).click();
  await expect(viewer).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(context.pages()).toHaveLength(1);
});

test("reference viewer stacks over result details and remains usable on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await references(page, 1);
  await page.getByRole("button", { name: "预览图片 1", exact: true }).click();
  const details = page.getByRole("dialog", { name: "图片预览", exact: true });
  const reference = details.getByRole("button", { name: "查看参考图片 1", exact: true });
  await reference.click();
  const viewer = page.getByRole("dialog", { name: "图片浏览", exact: true });
  await expect(viewer.locator(".browse-image-picture")).toHaveJSProperty("naturalWidth", 1200);
  await expect(viewer.getByRole("button", { name: "下一张图片", exact: true })).toHaveCount(0);
  await viewer.getByRole("button", { name: "向右旋转", exact: true }).click();
  await expect(viewer.locator(".browse-image-picture")).toHaveCSS("rotate", "90deg");
  await expect
    .poll(async () => (await viewer.locator(".browse-image-frame").boundingBox())?.height ?? 0)
    .toBeGreaterThan(250);
  await expect(viewer.getByRole("button", { name: "关闭图片浏览", exact: true })).toBeInViewport();
  expect(await viewer.evaluate((node) => node.scrollWidth <= innerWidth)).toBe(true);
  await viewer.getByRole("button", { name: "关闭图片浏览", exact: true }).click();
  await expect(viewer).toHaveCount(0);
  await expect(details).toBeVisible();
  await expect(reference).toBeFocused();
});

test("blank clicks dismiss at fitted and zoomed sizes without closing on image interaction", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await references(page);
  const trigger = page.getByRole("button", { name: "查看参考图片 1", exact: true });
  const viewer = page.getByRole("dialog", { name: "图片浏览", exact: true });
  for (const zoomed of [false, true]) {
    await trigger.click();
    await expect(viewer.locator(".browse-image-surface")).toHaveCSS("transform", "none");
    if (zoomed) await viewer.getByRole("button", { name: "放大图片", exact: true }).click();
    const picture = viewer.locator(".browse-image-picture");
    await picture.click();
    await expect(viewer).toBeVisible();
    await page.mouse.click(8, 8);
    await expect(viewer).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
});

test("image navigation hides boundary arrows and never wraps", async ({ page }) => {
  const ids = await references(page, 3);
  await page.getByRole("button", { name: "查看参考图片 1", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "图片浏览", exact: true });
  const picture = viewer.locator(".browse-image-picture");
  const previous = viewer.getByRole("button", { name: "上一张图片", exact: true });
  const next = viewer.getByRole("button", { name: "下一张图片", exact: true });
  await expect(previous).toHaveCount(0);
  await expect(next).toBeVisible();
  await viewer.getByRole("button", { name: "放大图片", exact: true }).click();
  await viewer.getByRole("button", { name: "关闭图片浏览", exact: true }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect(picture).toHaveAttribute("src", `/api/v1/image-assets/${ids[0]}/content`);
  await expect(viewer.getByLabel("图片缩放比例")).toHaveText("125%");
  await next.click();
  await expect(previous).toBeVisible();
  await expect(next).toBeVisible();
  await next.click();
  await expect(next).toHaveCount(0);
  await expect(previous).toBeVisible();
  await viewer.getByRole("button", { name: "关闭图片浏览", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(picture).toHaveAttribute("src", `/api/v1/image-assets/${ids[2]}/content`);
});

test("image loading keeps browsing controls hidden and leaves a stable close action", async ({
  page,
}) => {
  const ids = await references(page);
  let release = () => {};
  const loaded = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/api/v1/image-assets/${ids[0]}/content`, async (route) => {
    await loaded;
    await route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#e3d4bc"/></svg>',
    });
  });
  await page.getByRole("button", { name: "查看参考图片 1", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "图片浏览", exact: true });
  try {
    await expect(viewer.getByLabel("图片加载中")).toBeVisible();
    await expect(viewer.getByRole("toolbar", { name: "图片浏览工具" })).toBeHidden();
    await expect(viewer.getByRole("button", { name: "下一张图片", exact: true })).toHaveCount(0);
    await expect(viewer.locator(".browse-image-picture")).toBeHidden();
    await expect(viewer.getByRole("button", { name: "关闭图片浏览", exact: true })).toBeVisible();
    await viewer.getByRole("region", { name: "浏览图片区域", exact: true }).hover();
    await page.mouse.wheel(0, -100);
  } finally {
    release();
  }
  await expect(viewer.locator(".browse-image-picture")).toBeVisible();
  await expect(viewer.getByRole("toolbar", { name: "图片浏览工具" })).toBeVisible();
  await expect(viewer.getByLabel("图片缩放比例")).toHaveText("100%");
  await expect(viewer.getByLabel("图片加载中")).toHaveCount(0);
  await expect(viewer.getByRole("button", { name: "下一张图片", exact: true })).toBeVisible();
});

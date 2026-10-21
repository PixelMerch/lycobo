import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

// Large enough that a zoomed picture overflows the frame and can be panned.
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#7c3aed"/></svg>';

const asset = (position: number) => ({
  id: crypto.randomUUID(),
  public_id: `P5587123${position}`,
  kind: "output",
  width: 2048,
  height: 2048,
  bytes: 1024,
  created_at: "2026-10-20T01:00:00.000Z",
  model: "gpt-image-2",
  prompt: `素材 ${position + 1} 的创意描述`,
});

test("library and history images open an in-page full-screen viewer", async ({ page }) => {
  await mockImageApi(page);
  const assets = [0, 1, 2].map(asset);
  await page.route("**/api/v1/image-assets?*", (route) =>
    route.fulfill({ json: apiFixture({ data: assets }) }),
  );
  const job = {
    id: crypto.randomUUID(),
    public_id: "W00000013",
    organization_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    model: "gpt-image-2",
    prompt: "紫色菱形被子，参考图2的菱形格。",
    resolution: "1K",
    aspect_ratio: "1:1",
    requested_count: 2,
    status: "succeeded",
    created_at: "2026-10-20T01:00:00.000Z",
    completed_at: "2026-10-20T01:01:00.000Z",
    items: [0, 1].map((position) => ({
      id: crypto.randomUUID(),
      position,
      status: "succeeded",
      output_asset_id: crypto.randomUUID(),
      output_public_id: `P5587124${position}`,
      error_code: null,
      width: 2048,
      height: 2048,
      worker_id: "worker",
    })),
  };
  await page.route("**/api/v1/image-tasks*", (route) =>
    route.fulfill({ json: apiFixture({ data: [job] }) }),
  );
  await page.route("**/api/v1/image-assets/**/content*", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: svg }),
  );
  await page.setViewportSize({ width: 1328, height: 906 });
  await page.goto("/create");

  // History results open the viewer in place instead of a new browser tab.
  const historyDialog = page.getByRole("dialog", { name: "图片预览", exact: true });
  await page.getByRole("button", { name: "预览图片 2", exact: true }).click();
  await expect(historyDialog).toBeVisible();
  const historyBox = await historyDialog.boundingBox();
  expect(historyBox?.width).toBe(1328);
  expect(historyBox?.height).toBe(906);
  await expect(historyDialog.locator(".image-preview-section p")).toContainText("紫色菱形被子");
  await expect(historyDialog.locator(".image-preview-model")).toContainText("gpt-image-2");
  await expect(historyDialog.locator(".image-preview-facts")).toContainText("ID：P55871241");
  await expect(historyDialog.locator(".image-preview-bar-id")).toHaveText("Img ID：P55871241");
  await expect(historyDialog.locator(".image-preview-bar-size")).toHaveText("2048 x 2048");
  // The selected frame is one of two thumbnails on the right rail.
  await expect(historyDialog.locator(".image-preview-thumb")).toHaveCount(2);
  await expect(historyDialog.locator(".image-preview-thumb").nth(1)).toHaveAttribute(
    "aria-current",
    "true",
  );
  expect(new URL(page.url()).pathname).toBe("/create");
  // The redundant bottom download row is gone; the icon actions stay in the panel.
  await expect(historyDialog.locator(".image-preview-actions")).toHaveCount(0);
  await expect(historyDialog.getByRole("button", { name: "下载原图", exact: true })).toHaveCount(1);
  await historyDialog.getByRole("button", { name: "关闭图片预览", exact: true }).click();
  await expect(historyDialog).toHaveCount(0);

  // Library tiles open the same viewer and browse the whole filtered set.
  await page.getByRole("button", { name: "打开素材库", exact: true }).click();
  const libraryDialog = page.getByRole("dialog", { name: "资产管理", exact: true });
  await expect(libraryDialog).toBeVisible();
  await libraryDialog
    .getByRole("button", { name: "查看图片：素材 2 的创意描述", exact: true })
    .click();
  const viewer = page.getByRole("dialog", { name: "图片预览", exact: true });
  await expect(viewer).toBeVisible();
  // The preview and the asset library share the same close control size.
  const closeSizes = await page.evaluate(() => {
    const size = (selector: string) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return rect ? { width: Math.round(rect.width), height: Math.round(rect.height) } : null;
    };
    return { library: size(".library-close"), preview: size(".image-preview-close") };
  });
  expect(closeSizes.library).toEqual({ width: 44, height: 44 });
  expect(closeSizes.preview).toEqual(closeSizes.library);
  await expect(viewer.locator(".image-preview-thumb")).toHaveCount(3);
  await expect(viewer.locator(".image-preview-thumb").nth(1)).toHaveAttribute(
    "aria-current",
    "true",
  );
  // Wheel zoom caps at 500% and crops inside the stage instead of growing it.
  const stage = page.locator(".image-preview-stage");
  await stage.hover();
  for (let step = 0; step < 40; step += 1) await page.mouse.wheel(0, -200);
  await expect(viewer.locator(".image-preview-zoom-value")).toHaveText("500%");
  const zoomed = await page.evaluate(() => {
    const image = document.querySelector<HTMLElement>(".image-preview-image")!;
    const frame = document.querySelector<HTMLElement>(".image-preview-frame")!;
    const bar = document.querySelector<HTMLElement>(".image-preview-bar")!.getBoundingClientRect();
    return {
      scale: getComputedStyle(image).scale,
      frameOverflow: getComputedStyle(frame).overflow,
      barVisible: bar.bottom <= innerHeight + 1,
      noPageOverflow: document.documentElement.scrollWidth <= innerWidth,
    };
  });
  // Magnifying crops inside the frame: the layout and the bottom bar stay put.
  await expect
    .poll(() =>
      page.evaluate(() =>
        Number(getComputedStyle(document.querySelector(".image-preview-image")!).scale),
      ),
    )
    .toBeGreaterThan(4.9);
  expect(zoomed.frameOverflow).toBe("hidden");
  expect(zoomed.barVisible).toBe(true);
  expect(zoomed.noPageOverflow).toBe(true);
  // A zoomed picture advertises the pan with a hand cursor and follows the drag.
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.querySelector(".image-preview-frame")!).cursor),
    )
    .toBe("grab");
  const frameBox = (await page.locator(".image-preview-frame").boundingBox())!;
  const dragX = frameBox.x + frameBox.width / 2;
  const dragY = frameBox.y + frameBox.height / 2;
  await page.mouse.move(dragX, dragY);
  await page.mouse.down();
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.querySelector(".image-preview-frame")!).cursor),
    )
    .toBe("grabbing");
  await page.mouse.move(dragX - 120, dragY - 80, { steps: 4 });
  await page.mouse.up();
  const panned = await page.evaluate(() => {
    const [x = "0", y = "0"] = getComputedStyle(
      document.querySelector(".image-preview-image")!,
    ).translate.split(" ");
    return { x: Number.parseFloat(x) || 0, y: Number.parseFloat(y) || 0 };
  });
  expect(panned.x).toBeCloseTo(-120, 0);
  expect(panned.y).toBeCloseTo(-80, 0);
  // Reset to 100% so the remaining assertions read the fitted picture.
  await viewer.locator('[aria-label="缩放"] input[type="range"]').evaluate((input) => {
    (input as HTMLInputElement).focus();
  });
  await page.keyboard.press("Home");
  await expect(viewer.locator(".image-preview-zoom-value")).toHaveText("100%");
  // Fitted pictures return to the centre and lose the pan cursor.
  await expect
    .poll(() =>
      page.evaluate(() => {
        const translate = getComputedStyle(
          document.querySelector(".image-preview-image")!,
        ).translate;
        return Number.parseFloat(translate) || 0;
      }),
    )
    .toBe(0);
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.querySelector(".image-preview-frame")!).cursor),
    )
    .toBe("auto");
  // Fixed three-column layout: stage | details | thumbnail rail.
  const layout = await page.evaluate(() => {
    const box = (selector: string) => {
      const rect = document.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
      return rect ? { x: Math.round(rect.x), w: Math.round(rect.width) } : null;
    };
    return {
      stage: box(".image-preview-stage"),
      info: box(".image-preview-info"),
      rail: box(".image-preview-rail"),
    };
  });
  expect(layout.stage?.x).toBe(0);
  expect(layout.info?.x).toBe((layout.stage?.x ?? 0) + (layout.stage?.w ?? 0));
  expect(layout.rail?.x).toBe((layout.info?.x ?? 0) + (layout.info?.w ?? 0));
  expect((layout.rail?.x ?? 0) + (layout.rail?.w ?? 0)).toBe(1328);
  await viewer.getByRole("button", { name: "下一张", exact: true }).click();
  await expect(viewer.locator(".image-preview-thumb").last()).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(viewer.getByRole("region", { name: "创意描述", exact: true })).toContainText(
    "素材 3 的创意描述",
  );
  await viewer.getByRole("button", { name: "关闭图片预览", exact: true }).click();
  await expect(viewer).toHaveCount(0);
  // Closing the viewer returns to the library, not the workspace.
  await expect(libraryDialog).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await libraryDialog.getByRole("button", { name: /查看图片：素材 1/ }).click();
  await expect(viewer).toBeVisible();
  const close = await viewer
    .getByRole("button", { name: "关闭图片预览", exact: true })
    .boundingBox();
  expect(Math.round(close?.x ?? 0)).toBeGreaterThan(300);
  expect(Math.round(close?.y ?? -1)).toBeLessThan(20);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

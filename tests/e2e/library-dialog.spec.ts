import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);

test("history rail heading opens the full-screen asset library", async ({ page }) => {
  await mockImageApi(page);
  const assets = [
    {
      id: crypto.randomUUID(),
      kind: "output",
      width: 1024,
      height: 1024,
      bytes: 1024,
      created_at: "2026-10-20T01:00:00.000Z",
      model: "gpt-image-2",
      prompt: "素材一",
    },
    {
      id: crypto.randomUUID(),
      kind: "reference",
      width: 1024,
      height: 1536,
      bytes: 1024,
      created_at: "2026-10-20T01:00:00.000Z",
      model: null,
      prompt: "素材二",
    },
  ];
  let assetRequests = 0;
  await page.route("**/api/v1/image-assets?*", async (route) => {
    assetRequests += 1;
    await route.fulfill({ json: apiFixture({ data: assets }) });
  });
  await page.route("**/api/v1/image-assets/**/content*", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await page.setViewportSize({ width: 1328, height: 906 });
  await page.goto("/create");
  const entry = page.getByRole("button", { name: "打开素材库", exact: true });
  await expect(entry).toContainText("我的素材");
  // The library is lazy: browsing the workspace must not load every asset.
  expect(assetRequests).toBe(0);
  await entry.click();
  const dialog = page.getByRole("dialog", { name: "资产管理", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "资产管理" })).toBeVisible();
  await expect(dialog.locator(".library-tile")).toHaveCount(2);
  // Four large square previews per row at this width, with rounded corners.
  const tileShape = await dialog
    .locator(".library-tile")
    .first()
    .evaluate((node) => {
      const style = getComputedStyle(node);
      return { height: Number.parseFloat(style.height), radius: style.borderRadius };
    });
  expect(tileShape.height).toBeGreaterThan(250);
  expect(tileShape.radius).toBe("8px");
  // Only generated images carry a model badge; references have no model.
  await expect(dialog.locator(".library-tile-badge")).toHaveCount(1);
  await expect(dialog.locator(".library-tile-badge")).toHaveText("gpt-image-2");
  await expect(dialog.locator(".library-tile-badge")).toHaveClass(/model-tag/);
  await expect(dialog.locator(".library-tile-badge svg")).toHaveCount(0);
  // The shared model tag carries the same look in both places.
  const tagStyle = await dialog.locator(".library-tile-badge").evaluate((node) => {
    const style = getComputedStyle(node);
    return { font: style.fontSize, weight: style.fontWeight, color: style.color };
  });
  expect(tagStyle).toEqual({ font: "13px", weight: "500", color: "rgb(255, 255, 255)" });
  // The close glyph, the filters and the grid share the same left edge once the
  // entrance settles.
  await expect(dialog.locator(".library-shell")).toHaveCSS("transform", "none");
  const edges = await page.evaluate(() => {
    const left = (selector: string) =>
      document.querySelector<HTMLElement>(selector)?.getBoundingClientRect().x ?? -1;
    return {
      close: left(".library-close svg"),
      filter: left(".library-filter-trigger"),
      tile: left(".library-tile"),
    };
  });
  expect(edges.close).toBeCloseTo(edges.filter, 0);
  expect(edges.close).toBeCloseTo(edges.tile, 0);
  await dialog.getByRole("button", { name: /全部类型/ }).click();
  await page.getByRole("option", { name: "参考图片", exact: true }).click();
  await expect(dialog.locator(".library-tile")).toHaveCount(1);
  await dialog.getByRole("button", { name: "关闭资产管理", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(entry).toBeFocused();
  // Opening goes straight to a true full-screen surface, with no separate
  // expand control to reach for.
  await entry.click();
  await expect(dialog.locator(".library-shell")).toHaveCSS("transform", "none");
  const drawerBox = await dialog.boundingBox();
  expect(drawerBox?.x).toBeCloseTo(0, 0);
  expect(drawerBox?.y).toBeCloseTo(0, 0);
  expect(Math.round(drawerBox?.width ?? 0)).toBe(1328);
  expect(Math.round(drawerBox?.height ?? 0)).toBe(906);
  await expect(dialog.getByRole("button", { name: /全屏|退出全屏/ })).toHaveCount(0);
  await page.screenshot({ path: "/tmp/library-drawer.png" });
  await dialog.getByRole("button", { name: "关闭资产管理", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await entry.click();
  const box = await dialog.boundingBox();
  expect(box?.width).toBeCloseTo(390, 0);
  expect(box?.height).toBeCloseTo(844, 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

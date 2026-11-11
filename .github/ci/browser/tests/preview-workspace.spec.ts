import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#eee"/><rect x="160" y="300" width="700" height="400" rx="40" fill="#777"/></svg>';

test("preview keeps one canvas while repair changes only the property panel and retains each image draft", async ({
  page,
}) => {
  await mockImageApi(page);
  const assets = [0, 1].map((index) => ({
    id: crypto.randomUUID(),
    public_id: `PCANVAS0${index}`,
    task_public_id: `WCANVAS0${index}`,
    kind: "output",
    width: 1024,
    height: 1024,
    bytes: 1024,
    created_at: "2026-10-22T01:00:00.000Z",
    model: "gpt-image-2",
    prompt: `画布测试 ${index + 1}`,
  }));
  await page.route("**/api/v1/image-assets?*", (route) =>
    route.fulfill({ json: apiFixture({ data: assets }) }),
  );
  await page.route("**/api/v1/image-assets/**/content*", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: svg }),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/commerce/create");
  await page.getByRole("button", { name: "打开素材库", exact: true }).click();
  await page.getByRole("button", { name: "查看图片：画布测试 1", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "图片预览", exact: true });
  const toolbar = viewer.getByRole("toolbar", { name: "画布工具", exact: true });
  await expect(toolbar).toBeVisible();
  await expect(toolbar).toHaveAttribute("aria-orientation", "vertical");
  await expect(viewer.locator(".image-preview")).toHaveCSS("transform", "none");
  await expect(viewer.locator(".repair-canvas canvas").first()).toBeVisible();
  const dots = viewer.locator(".preview-canvas-stage .preview-dot-grid canvas");
  await expect(dots).toHaveCSS("pointer-events", "none");
  await expect(viewer.locator(".preview-canvas-stage .preview-dot-grid")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  const paintedDots = () =>
    dots.evaluate((node: HTMLCanvasElement) => {
      const pixels = node.getContext("2d")?.getImageData(0, 0, node.width, node.height).data;
      return pixels?.some((value, index) => index % 4 === 3 && value > 0) ?? false;
    });
  const stageBounds = await viewer.locator(".preview-canvas-stage").boundingBox();
  if (!stageBounds) throw new Error("Missing canvas stage");
  await page.mouse.move(stageBounds.x + 45, stageBounds.y + 45);
  await expect.poll(paintedDots).toBe(true);
  await expect.poll(paintedDots).toBe(false);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.mouse.move(stageBounds.x + 100, stageBounds.y + 45);
  await expect(dots).toBeVisible();
  await expect(viewer.locator(".preview-canvas-stage")).toHaveCSS(
    "background-image",
    /radial-gradient/,
  );
  expect(await paintedDots()).toBe(false);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(viewer.locator(".image-preview-bar")).toHaveCSS("position", "absolute");
  const dotsBounds = await dots.boundingBox();
  expect(dotsBounds?.height).toBe(stageBounds.height);

  const image = await viewer.locator(".image-preview-image").elementHandle();
  const canvas = await viewer.locator(".repair-canvas").elementHandle();
  if (!image || !canvas) throw new Error("Workspace did not load");
  await viewer.locator(".image-preview-stage").hover();
  await page.mouse.wheel(0, -100);
  await expect(viewer.getByLabel("画布缩放比例")).toHaveText("88%");
  await toolbar.getByRole("radio", { name: "拖动画布", exact: true }).click();
  const frame = await viewer.locator(".image-preview-frame").boundingBox();
  if (!frame) throw new Error("Missing canvas frame");
  const toolBounds = await toolbar.boundingBox();
  if (!toolBounds) throw new Error("Missing canvas toolbar");
  // The floating toolbar overlays the full canvas rather than reserving a column.
  expect(toolBounds.x).toBeGreaterThan(frame.x);
  expect(toolBounds.x + toolBounds.width).toBeLessThanOrEqual(frame.x + frame.width);
  expect(frame.x + frame.width).toBeGreaterThan(toolBounds.x);
  await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
  await page.mouse.down();
  await page.mouse.move(frame.x + frame.width / 2 + 50, frame.y + frame.height / 2 + 20, {
    steps: 5,
  });
  await page.mouse.up();
  const view = () =>
    image.evaluate((node) => {
      const box = node.getBoundingClientRect();
      return {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        scale: getComputedStyle(node).scale,
        pan: getComputedStyle(node).translate,
      };
    });
  const before = await view();
  await viewer.getByRole("button", { name: "局部编辑", exact: true }).click();
  await expect(
    viewer.getByRole("complementary", { name: "局部编辑设置", exact: true }),
  ).toBeVisible();
  expect(await image.evaluate((node) => node.isConnected)).toBe(true);
  expect(await canvas.evaluate((node) => node.isConnected)).toBe(true);
  expect(await view()).toEqual(before);
  await viewer.getByRole("button", { name: "添加区域", exact: true }).click();
  const prompt = viewer.getByRole("textbox", { name: "区域 1 修改说明", exact: true });
  await prompt.fill("颜色更柔和");
  await prompt.fill("颜色更柔和，保留光线");
  await toolbar.getByRole("button", { name: "撤销区域修改", exact: true }).click();
  await expect(prompt).toHaveValue("颜色更柔和");
  await toolbar.getByRole("button", { name: "重做区域修改", exact: true }).click();
  await expect(prompt).toHaveValue("颜色更柔和，保留光线");
  await prompt.fill("颜色更柔和");
  await page.screenshot({ path: "/tmp/lycobo-workspace-repair.png" });
  await viewer.getByRole("button", { name: "返回详情", exact: true }).click();
  expect(await image.evaluate((node) => node.isConnected)).toBe(true);
  expect(await view()).toEqual(before);
  await viewer.getByRole("button", { name: "局部编辑", exact: true }).click();
  await expect(prompt).toHaveValue("颜色更柔和");
  await viewer.getByRole("button", { name: "预览第 2 张", exact: true }).click();
  await expect(prompt).toHaveCount(0);
  await viewer.getByRole("button", { name: "添加区域", exact: true }).click();
  await prompt.fill("另一张的修改说明");
  await viewer.getByRole("button", { name: "预览第 1 张", exact: true }).click();
  await expect(prompt).toHaveValue("颜色更柔和");
  await viewer.getByRole("button", { name: "返回详情", exact: true }).click();
  // A text-only action: no leading glyph, at every breakpoint.
  const fitButton = viewer.getByRole("button", { name: "适应画布", exact: true });
  await expect(fitButton.locator("svg")).toHaveCount(0);
  await expect(fitButton).toContainText("适应画布");
  await fitButton.click();
  await expect(viewer.getByLabel("画布缩放比例")).toHaveText("80%");
  await expect(viewer.locator(".image-preview-image")).toHaveCSS("translate", "0px");
  await expect(viewer.locator(".image-preview-info")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "/tmp/lycobo-workspace-details.png" });
  await toolbar.getByRole("radio", { name: "选择区域", exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(toolbar.getByRole("radio", { name: "框选区域", exact: true })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(
    viewer.getByRole("complementary", { name: "局部编辑设置", exact: true }),
  ).toBeVisible();
  await expect(viewer.locator(".image-preview-image")).toHaveAttribute(
    "src",
    new RegExp(assets[0]?.id ?? "missing"),
  );
  await viewer.getByRole("button", { name: "返回详情", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(toolbar).toBeVisible();
  await expect(toolbar).toHaveAttribute("aria-orientation", "horizontal");
  await expect(toolbar.getByRole("radio", { name: "框选区域", exact: true })).toHaveCSS(
    "height",
    "44px",
  );
  expect(await viewer.evaluate((node) => node.scrollWidth <= window.innerWidth)).toBe(true);
  // The compact breakpoint keeps the label rather than shrinking to an
  // icon-sized box with no glyph inside.
  await expect(fitButton).toBeVisible();
  expect((await fitButton.boundingBox())?.width ?? 0).toBeGreaterThan(48);
  await expect(viewer.getByRole("slider", { name: "缩放", exact: true })).toBeHidden();
  const closeBounds = await viewer
    .getByRole("button", { name: "关闭图片预览", exact: true })
    .boundingBox();
  expect(closeBounds?.y).toBeLessThan(80);
  const mobileGeometry = await viewer.locator(".image-preview").evaluate((node) => {
    const bar = node.querySelector(".image-preview-bar")!.getBoundingClientRect();
    return {
      width: node.clientWidth,
      scrollWidth: node.scrollWidth,
      scrollLeft: node.scrollLeft,
      barLeft: bar.left,
      barWidth: bar.width,
    };
  });
  expect(mobileGeometry.scrollWidth).toBeLessThanOrEqual(mobileGeometry.width);
  expect(mobileGeometry.barLeft).toBeGreaterThanOrEqual(0);
  await expect(viewer.locator(".image-preview-bar")).not.toContainText("Img ID");
  await page.screenshot({ path: "/tmp/lycobo-workspace-mobile.png" });
  // A cached workspace must also open with immediate image navigation, not tool navigation.
  await viewer.getByRole("button", { name: "关闭图片预览", exact: true }).click();
  await page.getByRole("button", { name: "查看图片：画布测试 1", exact: true }).click();
  await expect(viewer.locator(".image-preview-image")).toHaveAttribute(
    "src",
    new RegExp(assets[0]?.id ?? "missing"),
  );
  await page.keyboard.press("ArrowRight");
  await expect(viewer.locator(".image-preview-image")).toHaveAttribute(
    "src",
    new RegExp(assets[1]?.id ?? "missing"),
  );
});

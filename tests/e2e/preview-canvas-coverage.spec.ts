import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

for (const width of [1440, 390]) {
  test(`preview canvas fills the left viewport and description expands after three lines (${width}px)`, async ({
    page,
  }) => {
    await mockImageApi(page);
    const items = [
      "第一行创意说明\n第二行创意说明\n第三行创意说明\n第四行创意说明\n第五行创意说明",
      "简短说明",
    ].map((prompt, index) => ({
      id: crypto.randomUUID(),
      public_id: `PCANVAS0${index}`,
      task_public_id: `WCANVAS0${index}`,
      kind: "output",
      width: 1024,
      height: 1024,
      bytes: 1024,
      created_at: "2026-10-22T01:00:00.000Z",
      model: "gpt-image-2",
      prompt,
    }));
    await page.route("**/api/v1/image-assets?*", (route) =>
      route.fulfill({ json: apiFixture({ data: items }) }),
    );
    await page.route("**/api/v1/image-assets/**/content*", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#aaa"/></svg>',
      }),
    );
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/create");
    await page.getByRole("button", { name: "打开素材库", exact: true }).click();
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole("button", { name: `查看图片：${items[0]?.prompt}`, exact: true }).click();
    const viewer = page.getByRole("dialog", { name: "图片预览", exact: true });
    const stage = viewer.locator(".preview-canvas-stage");
    const frame = viewer.locator(".image-preview-frame");
    const coverage = await stage.evaluate((node) => {
      const a = node.getBoundingClientRect();
      const frame = node.querySelector(".image-preview-frame");
      if (!frame) throw new Error("Missing image frame");
      const b = frame.getBoundingClientRect();
      return {
        left: b.left - a.left,
        top: b.top - a.top,
        right: a.right - b.right,
        bottom: a.bottom - b.bottom,
        padding: getComputedStyle(node).padding,
      };
    });
    expect(coverage).toEqual({ left: 0, top: 0, right: 0, bottom: 0, padding: "0px" });
    await expect(viewer.locator(".preview-canvas-dock")).toHaveCSS("position", "absolute");
    const bar = stage.locator(".image-preview-bar");
    await expect(bar).toHaveCSS("position", "absolute");
    await expect(viewer.locator(".image-preview-image")).toHaveCSS("scale", "0.8");
    const stageBox = await stage.boundingBox();
    const barBox = await bar.boundingBox();
    if (!stageBox || !barBox) throw new Error("Missing canvas controls");
    expect(barBox.y + barBox.height).toBeLessThan(stageBox.y + stageBox.height);
    expect(barBox.x).toBeGreaterThanOrEqual(stageBox.x);
    expect(barBox.x + barBox.width).toBeLessThanOrEqual(stageBox.x + stageBox.width);
    if (width === 1440) expect(stageBox.height).toBe(1000);
    const model = await viewer.locator(".image-preview-model").evaluate((node) => {
      const text = node.querySelector("span");
      const icon = node.querySelector("svg");
      if (!text || !icon) throw new Error("Missing model label");
      const range = document.createRange();
      range.selectNodeContents(text);
      const glyph = range.getBoundingClientRect();
      const label = text.getBoundingClientRect();
      const symbol = icon.getBoundingClientRect();
      return {
        clipped: glyph.top < label.top || glyph.bottom > label.bottom,
        centreOffset: Math.abs((symbol.top + symbol.bottom - label.top - label.bottom) / 2),
      };
    });
    expect(model.clipped).toBe(false);
    expect(model.centreOffset).toBeLessThanOrEqual(1);
    const description = viewer.getByRole("region", { name: "创意描述", exact: true });
    const paragraph = description.locator("p");
    await expect(paragraph).toHaveCSS("-webkit-line-clamp", "3");
    await expect(description.getByRole("button", { name: "展开全部", exact: true })).toBeVisible();
    const collapsed = (await paragraph.boundingBox())?.height ?? 0;
    await description.getByRole("button", { name: "展开全部", exact: true }).click();
    await expect(description.getByRole("button", { name: "收起", exact: true })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect((await paragraph.boundingBox())?.height ?? 0).toBeGreaterThan(collapsed);
    await description.getByRole("button", { name: "收起", exact: true }).click();
    await expect(paragraph).toHaveClass(/prompt-collapsed/);
    if (width === 1440) {
      const box = await frame.boundingBox();
      if (!box) throw new Error("Missing frame");
      await page.mouse.move(box.x + 3, box.y + box.height - 3);
      await page.mouse.down();
      await page.mouse.move(box.x + 103, box.y + box.height - 93, { steps: 5 });
      await page.mouse.up();
      await expect(viewer.locator(".image-preview-image")).toHaveCSS("translate", "100px -90px");
      await viewer.getByRole("button", { name: "适应画布", exact: true }).click();
      await expect(viewer.locator(".image-preview-image")).toHaveCSS("translate", "0px");
      const slider = viewer.getByRole("slider", { name: "缩放", exact: true });
      await slider.focus();
      await page.keyboard.press("Home");
      await expect(viewer.getByLabel("画布缩放比例")).toHaveText("25%");
      await viewer.getByRole("button", { name: "适应画布", exact: true }).click();
      await expect(viewer.getByLabel("画布缩放比例")).toHaveText("80%");
      await viewer.getByRole("button", { name: "预览第 2 张", exact: true }).click();
      await expect(
        viewer
          .getByRole("region", { name: "创意描述" })
          .getByRole("button", { name: "展开全部", exact: true }),
      ).toHaveCount(0);
    }
    expect(
      await viewer
        .locator(".image-preview")
        .evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
    ).toBe(true);
  });
}

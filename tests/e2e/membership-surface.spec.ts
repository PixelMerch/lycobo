import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

for (const width of [1440, 390]) {
  test(`membership opens with a stable opaque surface at ${width}px`, async ({ page }) => {
    await mockImageApi(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const draft = page.getByRole("textbox", { name: "创作需求", exact: true });
    await draft.fill("打开会员页前的草稿");
    await page.locator(".header-membership").click();
    const dialog = page.getByRole("dialog", { name: "会员订阅", exact: true });
    await expect(dialog).toBeAttached();
    const frames = await dialog.evaluate(async (node) => {
      const frames: { background: string; blur: string; opacity: string }[] = [];
      for (let index = 0; index < 16; index++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const style = getComputedStyle(node);
        frames.push({
          background: style.backgroundColor,
          blur: style.backdropFilter,
          opacity: style.opacity,
        });
      }
      return frames;
    });
    for (const frame of frames) {
      expect(frame.blur).toBe("none");
      expect(frame.background).toBe("rgb(15, 15, 18)");
      expect(frame.opacity).toBe("1");
    }
    await dialog.getByRole("button", { name: "关闭会员订阅", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(".header-membership")).toBeFocused();
    await expect(draft).toHaveValue("打开会员页前的草稿");
  });
}

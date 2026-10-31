import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

for (const width of [1440, 390]) {
  for (const path of ["/create", "/commerce/smart-variation", "/"]) {
    test(`ratio pager returns to the first page after selecting an extended ratio at ${width}px in ${path}`, async ({
      page,
    }) => {
      await mockImageApi(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      if (path === "/") {
        await page.getByRole("button", { name: "选择创作模型", exact: true }).click();
      }
      const picker =
        path === "/"
          ? page.getByRole("dialog", { name: "模型和画面设置", exact: true })
          : page.getByRole("region", { name: "图片比例", exact: true });
      const track = picker.getByRole("radiogroup", { name: "画面比例", exact: true });
      await picker.getByRole("button", { name: "下一页画面比例", exact: true }).click();
      await expect.poll(() => track.evaluate((node) => node.scrollLeft)).toBeGreaterThan(100);
      await track.getByRole("radio", { name: "3:4", exact: true }).click();
      await expect(track.getByRole("radio", { name: "3:4", exact: true })).toBeChecked();
      await picker.getByRole("button", { name: "上一页画面比例", exact: true }).click();
      await expect.poll(() => track.evaluate((node) => node.scrollLeft)).toBeLessThan(8);
      await track.getByRole("radio", { name: "2:3", exact: true }).click();
      await expect(track.getByRole("radio", { name: "2:3", exact: true })).toBeChecked();
      await expect.poll(() => track.evaluate((node) => node.scrollLeft)).toBeLessThan(8);
      await expect
        .poll(() =>
          track.evaluate((node) => {
            const selected = node.querySelector('[data-selected="true"]');
            if (!(selected instanceof HTMLElement)) return false;
            const box = selected.getBoundingClientRect();
            const viewport = node.getBoundingClientRect();
            return box.left >= viewport.left && box.right <= viewport.right;
          }),
        )
        .toBe(true);
      await page.keyboard.press("ArrowRight");
      await expect(track.getByRole("radio", { name: "3:2", exact: true })).toBeFocused();
      await page.keyboard.press("Space");
      await expect(track.getByRole("radio", { name: "3:2", exact: true })).toBeChecked();
    });
  }
}

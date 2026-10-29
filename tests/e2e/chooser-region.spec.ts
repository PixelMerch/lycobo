import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

for (const width of [390, 1440, 1920]) {
  test(`tool selector fits ${width}px and restores keyboard focus`, async ({ page }) => {
    await mockImageApi(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/create");
    const trigger = page.getByRole("button", { name: "主图制作 切换", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "选择工具" });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    if (!box) throw new Error("Tool selector is not visible");
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(await dialog.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("none");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.press("Enter");
    await expect(dialog).toBeVisible();
    const search = dialog.getByRole("textbox", { name: "搜索电商工具" });
    await expect(search).toBeFocused();
    await dialog.evaluate(async (el) => {
      await Promise.all(el.getAnimations().map((animation) => animation.finished));
    });
    const fixedHeight = (await dialog.boundingBox())?.height;
    const focusStyle = await search.evaluate((el) => {
      const style = getComputedStyle(el);
      return `${style.borderColor} ${style.outlineColor} ${style.boxShadow}`;
    });
    expect(focusStyle).not.toContain("4, 133, 247");
    await search.fill("不存在的工具");
    await expect(dialog.getByText("没有匹配的工具")).toBeVisible();
    expect((await dialog.boundingBox())?.height).toBe(fixedHeight);
    await search.fill("");
    if (width >= 768) {
      for (const category of ["主图制作", "商品视频", "全部工具"]) {
        await dialog.getByRole("radio", { name: category, exact: true }).click();
        expect((await dialog.boundingBox())?.height).toBe(fixedHeight);
      }
    }
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width < 768) {
      await page.getByRole("radio", { name: "历史记录", exact: true }).click();
      await expect(page.getByRole("region", { name: "工作区历史记录" })).toBeVisible();
      await expect(trigger).toBeHidden();
      await page.getByRole("radio", { name: "创作", exact: true }).click();
      await expect(trigger).toBeVisible();
      expect((await page.locator(".main-content").boundingBox())?.x).toBe(0);
    }
  });
}

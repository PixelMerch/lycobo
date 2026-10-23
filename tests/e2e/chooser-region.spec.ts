import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

for (const width of [1440, 1920]) {
  test(`model menu opens on arrow hover without blocking the workspace at ${width}px`, async ({
    page,
  }) => {
    await mockImageApi(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/create");
    for (const collapsed of [false, true]) {
      if (collapsed) await page.getByRole("button", { name: "收起导航栏", exact: true }).click();
      const trigger = page.getByRole("button", { name: "浏览模型", exact: true });
      await trigger.hover();
      const menu = page.getByRole("menu", { name: "浏览模型", exact: true });
      await expect(menu).toBeVisible();
      await expect(menu.getByRole("menuitem")).toHaveCount(3);
      await menu.getByRole("menuitem").first().hover();
      await expect(menu).toBeVisible();
      const box = await menu.boundingBox();
      const sidebar = await page.locator(".sidebar").boundingBox();
      expect(box && sidebar && box.x >= sidebar.x + sidebar.width - 1).toBeTruthy();
      const rows = await menu
        .getByRole("menuitem")
        .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().top));
      expect(rows[1]).toBeGreaterThan(rows[0] ?? 0);
      expect(rows[2]).toBeGreaterThan(rows[1] ?? 0);
      await expect(page.locator(".modal__backdrop")).toHaveCount(0);
      await expect(page.getByLabel("提示词", { exact: true })).toBeEnabled();
      expect(await page.locator("main").evaluate((el) => el.closest("[inert]") === null)).toBe(
        true,
      );
      expect(await menu.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("none");
      await page.mouse.move(width - 100, 500);
      await expect(menu).toBeHidden();
      await trigger.focus();
      await trigger.press("Enter");
      await expect(menu.getByRole("menuitem").first()).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
      await expect(trigger).toBeFocused();
    }
  });
}

for (const width of [1024, 390]) {
  test(`model menu supports click and narrow navigation at ${width}px`, async ({ page }) => {
    await mockImageApi(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    if (width < 768) await page.getByRole("button", { name: "打开导航", exact: true }).click();
    const navigation = width < 768 ? page.locator(".mobile-nav") : page.locator(".sidebar");
    await navigation.getByRole("button", { name: "浏览模型", exact: true }).click();
    const menu = page.getByRole("menu", { name: "浏览模型", exact: true });
    await expect(menu).toBeVisible();
    const panel = await page.locator(".creation-model-menu").boundingBox();
    if (!panel) throw new Error("Missing model menu");
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(width);
    await menu.getByRole("menuitem", { name: "进入 nano-banana-2.1 创作", exact: true }).click();
    await expect(page).toHaveURL(/\/create$/);
    await expect(page.getByLabel("提示词", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /创作模型/ })).toContainText("nano-banana-2.1");
    await expect(menu).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("navigation model choices retain each draft and direct creation keeps the selected model", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.goto("/create");
  const prompt = page.getByLabel("提示词", { exact: true });
  await prompt.fill("商品主图草稿");
  const select = async (id: string) => {
    await page.getByRole("button", { name: "浏览模型", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: `进入 ${id} 创作`, exact: true }).click();
  };
  await select("nano-banana-2.1");
  await prompt.fill("场景创作草稿");
  await select("gpt-image-2");
  await expect(prompt).toHaveValue("商品主图草稿");
  await select("nano-banana-2.1");
  await expect(prompt).toHaveValue("场景创作草稿");
  await page.getByRole("link", { name: "首页", exact: true }).click();
  await page.getByRole("link", { name: "创作", exact: true }).click();
  await expect(prompt).toHaveValue("场景创作草稿");
  await expect(
    page.getByRole("region", { name: "创作参数" }).getByRole("button", { name: /创作模型/ }),
  ).toContainText("nano-banana-2.1");
});

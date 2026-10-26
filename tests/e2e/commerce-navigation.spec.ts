import { expect, test } from "@playwright/test";
import { mockImageApi } from "./image-api-fixture";

test.beforeEach(async ({ page }) => {
  await mockImageApi(page);
});

test("commerce hover cards share model styling and preserve the current creation draft", async ({
  page,
}) => {
  await page.goto("/create");
  const prompt = page.getByLabel("提示词", { exact: true });
  await prompt.fill("保留我的家纺主图草稿");
  await page.getByRole("button", { name: "浏览模型", exact: true }).click();
  const modelStyle = await page.locator(".creation-model-menu").evaluate((el) => {
    const c = getComputedStyle(el);
    return {
      background: c.backgroundColor,
      radius: c.borderRadius,
      width: c.width,
      padding: c.padding,
    };
  });
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "AI 电商", exact: true }).hover();
  const menu = page.getByRole("menu", { name: "浏览电商功能", exact: true });
  await expect(menu).toBeVisible();
  const commerceStyle = await page.locator(".commerce-function-menu").evaluate((el) => {
    const c = getComputedStyle(el);
    return {
      background: c.backgroundColor,
      radius: c.borderRadius,
      width: c.width,
      padding: c.padding,
    };
  });
  expect(commerceStyle).toEqual(modelStyle);
  await expect(page).toHaveURL(/\/create$/);
  await expect(page.locator(".commerce-nav-row")).not.toHaveAttribute("data-active", "true");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(menu.getByRole("menuitem")).toHaveCount(1);
  const card = menu.getByRole("menuitem", { name: "查看家纺主图裂变", exact: true });
  await expect(card).toContainText("即将上线");
  await card.click();
  await expect(page).toHaveURL(/\/commerce\/textile-set$/);
  await expect(page.getByRole("heading", { name: "家纺主图裂变", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "家纺主图裂变参数", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "立即生成", exact: true })).toBeDisabled();
  await expect(page.locator(".commerce-nav-row")).toHaveAttribute("data-active", "true");
  await page.getByRole("link", { name: "创作", exact: true }).click();
  await expect(prompt).toHaveValue("保留我的家纺主图草稿");
});

test("commerce text goes directly to its page and the arrow toggles its menu", async ({ page }) => {
  await page.goto("/");
  const link = page.getByRole("link", { name: "AI 电商", exact: true });
  await link.click();
  await expect(page).toHaveURL(/\/commerce\/textile-set$/);
  await expect(page.getByRole("heading", { name: "家纺主图裂变", exact: true })).toBeVisible();
  await expect(page.getByRole("menu")).toHaveCount(0);
  const arrow = page.getByRole("button", { name: "浏览电商功能", exact: true });
  await arrow.click();
  const menu = page.getByRole("menu", { name: "浏览电商功能", exact: true });
  await expect(menu).toBeVisible();
  await arrow.click();
  await expect(menu).toBeHidden();
  await page.mouse.move(800, 600);
  await link.focus();
  await link.press("ArrowDown");
  await expect(menu.getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(arrow).toBeFocused();
});

for (const width of [390, 1440]) {
  test(`commerce function browsing works in ${width < 768 ? "mobile" : "collapsed"} navigation`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    if (width < 768) {
      await page.getByRole("button", { name: "打开导航", exact: true }).click();
      await page
        .locator(".mobile-nav")
        .getByRole("button", { name: "浏览电商功能", exact: true })
        .click();
    } else {
      await page.getByRole("button", { name: "收起导航栏", exact: true }).click();
      await expect(page.getByRole("button", { name: "浏览电商功能", exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "AI 电商", exact: true }).hover();
      await expect(page.getByRole("tooltip", { name: /AI.*电商/ })).toHaveCount(0);
    }
    const menu = page.getByRole("menu", {
      name: width < 768 ? "浏览电商功能" : "AI 电商",
      exact: true,
    });
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: "查看家纺主图裂变", exact: true }).click();
    await expect(page).toHaveURL(/\/commerce\/textile-set$/);
    await expect(page.getByRole("heading", { name: "家纺主图裂变", exact: true })).toBeVisible();
    await expect(menu).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width < 768) await expect(page.locator(".mobile-nav")).toBeHidden();
    else {
      const icon = page.getByRole("button", { name: "AI 电商", exact: true });
      await icon.focus();
      await icon.press("Enter");
      await expect(page).toHaveURL(/\/commerce\/textile-set$/);
      await expect(menu).toBeHidden();
    }
  });
}

test("commerce entry remembers a valid tool across reloads and falls back from retired tools", async ({
  page,
}) => {
  await page.goto("/commerce/textile-set");
  await expect(page.getByRole("heading", { name: "家纺主图裂变", exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("lycobo.commerce.recent-tool"))).toBe(
    "textile-set",
  );
  await page.goto("/commerce");
  await expect(page).toHaveURL(/\/commerce\/textile-set$/);
  await page.reload();
  await page.getByRole("link", { name: "首页", exact: true }).click();
  await page.getByRole("link", { name: "AI 电商", exact: true }).click();
  await expect(page).toHaveURL(/\/commerce\/textile-set$/);
  await page.evaluate(() => localStorage.setItem("lycobo.commerce.recent-tool", "retired-tool"));
  await page.goto("/commerce");
  await expect(page).toHaveURL(/\/commerce\/textile-set$/);
  expect(await page.evaluate(() => localStorage.getItem("lycobo.commerce.recent-tool"))).toBe(
    "textile-set",
  );
});

test("commerce entry remains available when browser storage is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });
  });
  await page.goto("/commerce");
  await expect(page).toHaveURL(/\/commerce\/textile-set$/);
  await expect(page.getByRole("region", { name: "家纺主图裂变参数", exact: true })).toBeVisible();
});

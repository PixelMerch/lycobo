import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

for (const width of [1440, 320]) {
  test(`combined account menu routes its five actions and supports keyboard access at ${width}px`, async ({
    page,
  }) => {
    await mockImageApi(page);
    const account = {
      userId: crypto.randomUUID(),
      organizationId: crypto.randomUUID(),
      uid: "0123456789",
      role: "admin",
      account: "merchant-fixture",
    };
    await page.route("**/api/v1/auth/session", (route) =>
      route.fulfill({ json: apiFixture(account) }),
    );
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/create");
    const trigger = page.getByRole("button", { name: `账户菜单：${account.account}`, exact: true });
    await expect(trigger).toContainText("200");
    await expect(trigger.locator(".avatar")).toHaveCount(1);
    await expect(page.locator(".credit-pill")).toHaveCount(0);
    const draft = page.getByLabel("提示词", { exact: true });
    await draft.fill("保留正在准备的商品图");
    await trigger.focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu", { name: `账户菜单：${account.account}`, exact: true });
    await expect(menu.getByRole("menuitem")).toHaveText([
      "个人作品",
      "个人信息",
      "订阅与账单",
      "账号管理",
      "退出登录",
    ]);
    await expect(page.locator(".header-account-name")).toHaveText(account.account);
    await expect(menu.getByRole("separator")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await menu.getByRole("menuitem", { name: "个人信息", exact: true }).click();
    const panel = page.getByRole("dialog", { name: "账户中心", exact: true });
    await expect(panel.getByRole("tab", { name: "个人信息", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await panel.getByRole("button", { name: "关闭账户中心", exact: true }).click();

    await trigger.click();
    await menu.getByRole("menuitem", { name: "账号管理", exact: true }).click();
    await expect(panel.getByRole("tab", { name: "账号管理", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(panel.getByText(account.uid, { exact: true })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await panel.getByRole("button", { name: "关闭账户中心", exact: true }).click();

    await trigger.click();
    await menu.getByRole("menuitem", { name: "个人作品", exact: true }).click();
    await expect(page).toHaveURL(/\/assets$/);
    await page.goBack();
    await expect(draft).toHaveValue("保留正在准备的商品图");
    await trigger.click();
    await expect(menu).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await expect(page.locator(".header-account-menu")).not.toHaveAttribute("data-entering", "true");
    await expect(page.locator(".header-account-menu")).toHaveCSS("opacity", "1");
    const box = await page.locator(".header-account-menu").boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `/tmp/lycoboai-account-menu-${width}.png` });
  });
}

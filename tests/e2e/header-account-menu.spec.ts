import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

for (const width of [1440, 320]) {
  test(`combined account menu routes its actions and supports hover, keyboard and independent dialogs at ${width}px`, async ({
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
    // Keyboard focus draws the purple ring; pointer focus never does.
    await expect(menu.getByRole("menuitem").first()).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveCSS("outline-style", "solid");

    // Hovering the capsule opens the menu without stealing the prompt focus.
    await draft.click();
    await trigger.hover();
    await expect(menu).toBeVisible();
    await expect(draft).toBeFocused();
    const popover = page.locator(".header-account-menu");
    await expect(popover).not.toHaveAttribute("data-entering", "true");
    // Compact menu: the credits read as a value row, not the primary figure.
    await expect(popover).toHaveCSS("width", "280px");
    await expect(popover.locator(".header-account-balance strong")).toHaveCSS("font-size", "14px");
    // Credits use the shared Tabler coin instead of the retired bitmap.
    await expect(popover.locator(".header-account-balance .credit-coin")).toHaveCSS(
      "width",
      "18px",
    );
    // HeroUI focuses the menu container and the hovered row for assistive tech.
    // Neither may paint the global purple ring around the list or the row.
    await expect(popover.locator(".dropdown__menu")).toHaveCSS("outline-style", "none");
    const hovered = menu.getByRole("menuitem", { name: "订阅与账单", exact: true });
    await hovered.hover();
    await expect(hovered).toHaveCSS("outline-style", "none");
    // A press on the already hovered capsule keeps the menu open.
    await trigger.click();
    await page.waitForTimeout(300);
    await expect(menu).toBeVisible();
    // Leaving both surfaces closes the menu; an outside press also closes it.
    await page.locator("body").click({ position: { x: 5, y: 300 } });
    await expect(menu).toHaveCount(0);

    await trigger.hover();
    await menu.getByRole("menuitem", { name: "个人信息", exact: true }).click();
    const panel = page.getByRole("dialog", { name: "个人信息", exact: true });
    await expect(page.getByRole("dialog")).toHaveCount(1);
    // The dialog container takes programmatic focus without a purple frame, and
    // each account dialog uses a neutral surface above the dimmed studio.
    await expect(panel).toHaveCSS("outline-style", "none");
    await expect(panel).toHaveCSS("background-color", "rgb(26, 26, 26)");
    await expect(panel.getByRole("tab")).toHaveCount(0);
    const profileHeight = (await panel.boundingBox())?.height ?? 0;
    await panel.getByRole("button", { name: "关闭个人信息", exact: true }).click();
    for (const title of ["订阅与账单", "账号管理"]) {
      await trigger.hover();
      await menu.getByRole("menuitem", { name: title, exact: true }).click();
      const independent = page.getByRole("dialog", { name: title, exact: true });
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await expect(independent.getByRole("tablist", { name: "账户信息", exact: true })).toHaveCount(
        0,
      );
      if (title === "订阅与账单") {
        await expect(independent.getByText("企业金币余额", { exact: true })).toBeVisible();
      } else {
        await expect(independent.getByText(`账号 ${account.uid}`, { exact: true })).toBeVisible();
        expect((await independent.boundingBox())?.height ?? 0).toBeGreaterThan(profileHeight);
      }
      await independent.getByRole("button", { name: `关闭${title}`, exact: true }).click();
    }

    await trigger.hover();
    await menu.getByRole("menuitem", { name: "个人作品", exact: true }).click();
    await expect(page).toHaveURL(/\/assets$/);
    await page.goBack();
    await expect(draft).toHaveValue("保留正在准备的商品图");
    await trigger.hover();
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

test.describe("touch", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("tapping the capsule opens the menu and a row opens the account center", async ({
    page,
  }) => {
    await mockImageApi(page);
    await page.route("**/api/v1/auth/session", (route) =>
      route.fulfill({
        json: apiFixture({
          userId: crypto.randomUUID(),
          organizationId: crypto.randomUUID(),
          uid: "0123456789",
          role: "admin",
          account: "touch-fixture",
        }),
      }),
    );
    await page.goto("/create");
    const trigger = page.getByRole("button", { name: "账户菜单：touch-fixture", exact: true });
    await trigger.tap();
    const menu = page.getByRole("menu", { name: "账户菜单：touch-fixture", exact: true });
    await expect(menu).toBeVisible();
    await expect(page.locator(".header-account-menu")).not.toHaveAttribute("data-entering", "true");
    const item = menu.getByRole("menuitem", { name: "个人信息", exact: true });
    const box = (await item.boundingBox())!;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByRole("dialog", { name: "个人信息", exact: true })).toBeVisible();
  });
});

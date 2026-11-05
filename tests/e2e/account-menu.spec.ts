import { expect, type Page, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

async function signIn(page: Page, account: string) {
  await mockImageApi(page);
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: apiFixture({
        userId: crypto.randomUUID(),
        organizationId: crypto.randomUUID(),
        uid: "0123456789",
        role: "admin",
        account,
      }),
    }),
  );
}

for (const width of [1440, 320]) {
  test(`signed-in account sits at the foot of the navigation and opens its menu upward at ${width}px`, async ({
    page,
  }) => {
    const account = "13800138000";
    await signIn(page, account);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/create");
    const draft = page.getByLabel(/^(提示词|制作要求)$/, { exact: true });
    await draft.fill("保留正在准备的商品图");
    // The account stays in navigation; the header only adds shared credits and membership.
    await expect(page.locator(".topbar .account-trigger")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "登录领积分", exact: true })).toHaveCount(0);
    const openNavigation = async () => {
      if (width < 768) await page.getByRole("button", { name: "打开导航", exact: true }).click();
    };
    await openNavigation();
    const navigation = page.locator(width < 768 ? ".mobile-nav" : ".sidebar");
    const trigger = navigation.getByRole("button", {
      name: `账户菜单：${account}`,
      exact: true,
    });
    await expect(trigger.locator(".account-trigger-name")).toHaveText(account);
    await expect(trigger.locator(".account-credits")).toHaveCount(0);
    await expect(trigger.locator(".avatar")).toHaveCount(1);
    await expect(trigger).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(navigation.locator(".account-footer")).toHaveCSS("border-top-width", "1px");
    await expect(page.locator(".credit-pill")).toHaveCount(0);
    if (width < 768) await expect(page.locator(".drawer__backdrop")).toHaveCSS("opacity", "1");
    await navigation
      .locator(".account-footer")
      .screenshot({ path: `/tmp/lycobo-footer-${width}.png` });
    const updates = navigation.getByRole("button", { name: "更新记录", exact: true });
    await updates.click();
    const updatesPanel = page.getByRole("dialog", { name: "最近更新" });
    await expect(updatesPanel).toBeVisible();
    await expect(updatesPanel).toHaveCSS("width", `${Math.min(640, width)}px`);
    await expect(page.locator(".drawer__backdrop").last()).toHaveCSS("opacity", "1");
    await updatesPanel.screenshot({ path: `/tmp/lycobo-updates-${width}.png` });
    await expect(updatesPanel.getByText("v0.4.4", { exact: true })).toBeVisible();
    await expect(updatesPanel.getByRole("link", { name: "查看版本详情" })).toHaveAttribute(
      "href",
      "https://github.com/PixelMerch/lycobo/releases/tag/v0.4.4",
    );
    await page.keyboard.press("Escape");
    await expect(updatesPanel).toBeHidden();
    await expect(updates).toBeFocused();
    await navigation.getByRole("button", { name: "消息", exact: true }).click();
    const messagesPanel = page.getByRole("dialog", { name: "消息中心" });
    await expect(messagesPanel.getByText("消息功能即将开放")).toBeVisible();
    const messageClose = messagesPanel.getByRole("button", { name: "关闭消息中心" });
    await messageClose.hover();
    await expect(messageClose).toHaveCSS("width", "44px");
    await expect(messageClose.locator("svg")).toHaveCSS("width", "22px");
    await expect(messageClose).toHaveCSS("outline-style", "none");
    const closeHover = await messageClose.evaluate(
      (element) => getComputedStyle(element).backgroundImage,
    );
    await messagesPanel.screenshot({ path: `/tmp/lycobo-message-close-${width}.png` });
    await messageClose.click();
    await expect(messagesPanel).toBeHidden();

    await trigger.focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu", { name: `账户菜单：${account}`, exact: true });
    // The menu is the account center's shortcut: credit actions, membership, then destinations.
    await expect(menu.getByRole("menuitem")).toHaveText([
      "充值积分",
      "积分明细",
      /会员\s*未开通\s*查看方案/,
      "积分与账单",
      "个人作品",
      "设置",
      "退出登录",
    ]);
    await expect(page.locator(".account-menu-name")).toHaveText(account);
    await expect(page.locator(".account-menu-details")).toContainText("UID 0123456789 · 管理员");
    await expect(page.locator("html")).toHaveCSS("overflow", "hidden");
    await expect(menu.getByRole("separator")).toHaveCount(1);
    // Keyboard focus draws the purple ring; pointer focus never does.
    await expect(menu.getByRole("menuitem").first()).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveCSS("outline-style", "solid");

    // A press opens the menu above the capsule; hovering alone does not.
    await trigger.hover();
    await expect(menu).toHaveCount(0);
    await trigger.click();
    await expect(menu).toBeVisible();
    const popover = page.locator(".account-menu");
    await expect(popover).not.toHaveAttribute("data-entering", "true");
    const [menuBox, triggerBox] = [await popover.boundingBox(), await trigger.boundingBox()];
    expect((menuBox?.y ?? 0) + (menuBox?.height ?? 0)).toBeLessThanOrEqual(triggerBox?.y ?? 0);
    expect(menuBox?.x).toBeGreaterThanOrEqual(0);
    expect((menuBox?.x ?? 0) + (menuBox?.width ?? 0)).toBeLessThanOrEqual(width);
    // Compact menu: the shared balance leads a small card, never a page-sized figure.
    await expect(popover).toHaveCSS("width", `${Math.min(280, width - 24)}px`);
    await expect(popover.locator(".account-menu-balance strong")).toHaveCSS("font-size", "18px");
    await expect(popover.locator(".account-menu-balance small")).toHaveText(
      "每张 2 积分 · 约可生成 100 张",
    );
    // Credits use the shared Tabler coin instead of the retired bitmap.
    await expect(popover.locator(".account-menu-balance .credit-coin")).toHaveCSS("width", "18px");
    // HeroUI focuses the menu container and the hovered row for assistive tech.
    // Neither may paint the global purple ring around the list or the row.
    await expect(popover.locator(".dropdown__menu")).toHaveCSS("outline-style", "none");
    const hovered = menu.getByRole("menuitem", { name: "积分与账单", exact: true });
    await hovered.hover();
    await expect(hovered).toHaveCSS("outline-style", "none");
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);

    // Recharge opens over the current page; closing returns focus to the account row.
    await trigger.click();
    await menu.getByRole("menuitem", { name: "充值积分", exact: true }).click();
    const recharge = page.getByRole("dialog", { name: "充值积分", exact: true });
    await expect(recharge).toBeVisible();
    // The dialog container takes programmatic focus without a purple frame.
    await expect(recharge).toHaveCSS("outline-style", "none");
    await expect(recharge).toHaveCSS("background-color", "rgb(26, 26, 26)");
    const rechargeClose = recharge.getByRole("button", { name: "关闭充值积分" });
    await rechargeClose.hover();
    await expect(rechargeClose).toHaveCSS("background-image", closeHover);
    await expect(rechargeClose).toHaveCSS("width", "44px");
    await expect(recharge.getByRole("button", { name: "立即购买", exact: true })).toBeDisabled();
    await rechargeClose.click();
    await expect(recharge).toHaveCount(0);
    // On phones the drawer stays open beneath the overlay, so focus returns there too.
    await expect(trigger).toBeFocused();

    // The account center opens above the current page (and above the phone drawer, like
    // recharge); closing it returns focus to the account row and keeps the creative draft.
    await trigger.click();
    await menu.getByRole("menuitem", { name: "设置", exact: true }).click();
    const settings = page.getByRole("dialog", { name: "设置", exact: true });
    await expect(settings.getByRole("tab", { name: "个人资料", selected: true })).toBeVisible();
    await expect(settings.locator(".account-profile-meta")).toContainText("UID 0123456789");
    await expect(page).toHaveURL(/\/create$/);
    const centerClose = settings.getByRole("button", { name: "关闭设置" });
    await expect(centerClose).toHaveCSS("width", "44px");
    await centerClose.click();
    await expect(settings).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(draft).toHaveValue("保留正在准备的商品图");
    await trigger.click();
    await menu.getByRole("menuitem", { name: "积分与账单", exact: true }).click();
    const center = page.getByRole("dialog", { name: "积分与账单", exact: true });
    await expect(center.getByRole("tab", { name: "积分明细", selected: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(center).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await menu.getByRole("menuitem", { name: "个人作品", exact: true }).click();
    await expect(page).toHaveURL(/\/assets$/);
    // Leaving through the menu also closes the mobile navigation drawer.
    await expect(page.locator(".mobile-nav")).toHaveCount(0);
    await page.goBack();
    await expect(draft).toHaveValue("保留正在准备的商品图");
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await openNavigation();
    await trigger.click();
    await expect(menu).toBeVisible();
    await expect(popover).toHaveCSS("opacity", "1");
    await popover.screenshot({ path: `/tmp/lycobo-typography-account-menu-${width}.png` });
    await page.screenshot({ path: `/tmp/lycoboai-account-menu-${width}.png` });
  });
}

test("the collapsed sidebar keeps the account as its avatar", async ({ page }) => {
  await signIn(page, "collapsed-fixture");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/create");
  await page.getByRole("button", { name: "收起导航栏", exact: true }).click();
  const trigger = page.getByRole("button", { name: "账户菜单：collapsed-fixture", exact: true });
  await expect(trigger.locator(".account-trigger-name")).toBeHidden();
  await expect(page.locator(".sidebar .account-footer-tools")).toBeHidden();
  await expect.poll(async () => (await trigger.boundingBox())?.width).toBe(32);
  await trigger.click();
  await expect(page.getByRole("menu", { name: "账户菜单：collapsed-fixture" })).toBeVisible();
});

test.describe("touch", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("tapping the capsule opens the menu and a row opens the account center", async ({
    page,
  }) => {
    await signIn(page, "touch-fixture");
    await page.goto("/create");
    await page.getByRole("button", { name: "打开导航", exact: true }).tap();
    const trigger = page.getByRole("button", { name: "账户菜单：touch-fixture", exact: true });
    await trigger.tap();
    const menu = page.getByRole("menu", { name: "账户菜单：touch-fixture", exact: true });
    await expect(menu).toBeVisible();
    await expect(page.locator(".account-menu")).not.toHaveAttribute("data-entering", "true");
    const item = menu.getByRole("menuitem", { name: "积分与账单", exact: true });
    const box = await item.boundingBox();
    if (!box) throw new Error("Missing account menu row");
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.getByRole("dialog", { name: "积分与账单", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/create$/);
  });
});

test("account news slides from the right and respects reduced motion", async ({ page }) => {
  await signIn(page, "13800138000");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/create");
  const motion = page.evaluate(async () => {
    await new Promise<void>((resolve) =>
      document.addEventListener("click", () => resolve(), { once: true, capture: true }),
    );
    const samples = [];
    const start = performance.now();
    while (performance.now() - start < 600) {
      await new Promise(requestAnimationFrame);
      const element = document.querySelector(".account-news-panel");
      if (element)
        samples.push({
          left: element.getBoundingClientRect().left,
          animations: (element.closest(".drawer__content")?.getAnimations() ?? []).map((item) => ({
            duration: item.effect?.getTiming().duration,
            state: item.playState,
          })),
        });
    }
    return samples;
  });
  await page.getByRole("button", { name: "更新记录", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "最近更新" });
  const samples = await motion;
  expect(
    samples.some((sample) =>
      sample.animations.some((animation) => Number(animation.duration) >= 400),
    ),
  ).toBe(true);
  expect(samples.some((sample) => sample.left > 801)).toBe(true);
  expect(samples.at(-1)?.left).toBeCloseTo(800, 0);
  await page.keyboard.press("Escape");
  const exit = await panel.evaluate((element) => {
    const content = element.closest(".drawer__content");
    const animation = content?.getAnimations()[0];
    return {
      exiting: content?.getAttribute("data-exiting"),
      duration: animation?.effect?.getTiming().duration,
    };
  });
  expect(exit.exiting).toBe("true");
  expect(Number(exit.duration)).toBeGreaterThanOrEqual(300);
  await expect(panel).toBeHidden();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "消息", exact: true }).click();
  const messages = page.getByRole("dialog", { name: "消息中心" });
  await expect(messages).toHaveCSS("transition-duration", "0s");
  await expect(messages).toHaveCSS("translate", "none");
  await page.keyboard.press("Escape");
  await expect(messages).toBeHidden();
});

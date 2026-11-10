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
  test(`signed-in account opens from the top bar on desktop and the drawer foot on phones at ${width}px`, async ({
    page,
  }) => {
    const account = "13800138000";
    await signIn(page, account);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/commerce/create");
    const draft = page.getByLabel(/^(提示词|制作要求)$/, { exact: true });
    await draft.fill("保留正在准备的商品图");
    const desktop = width >= 768;
    // 桌面账户头像在顶部栏右侧；手机顶部栏只放积分与会员，账户在导航抽屉底部。
    if (!desktop) await expect(page.locator(".topbar .account-trigger")).toBeHidden();
    await expect(page.getByRole("button", { name: "登录领积分", exact: true })).toHaveCount(0);
    const openNavigation = async () => {
      if (width < 768) await page.getByRole("button", { name: "打开导航", exact: true }).click();
    };
    await openNavigation();
    const navigation = page.locator(desktop ? ".topbar" : ".mobile-nav");
    const trigger = navigation.getByRole("button", {
      name: `账户菜单：${account}`,
      exact: true,
    });
    if (desktop) await expect(trigger.locator(".account-trigger-name")).toHaveCount(0);
    else await expect(trigger.locator(".account-trigger-name")).toHaveText(account);
    await expect(trigger.locator(".account-credits")).toHaveCount(0);
    await expect(trigger.locator(".avatar")).toHaveCount(1);
    await expect(trigger).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    if (!desktop)
      await expect(navigation.locator(".account-footer")).toHaveCSS("border-top-width", "1px");
    await expect(page.locator(".credit-pill")).toHaveCount(0);
    if (width < 768) await expect(page.locator(".drawer__backdrop")).toHaveCSS("opacity", "1");
    await navigation
      .locator(desktop ? ".account-header" : ".account-footer")
      .screenshot({ path: `/tmp/lycobo-footer-${width}.png` });
    // 顶部栏和手机抽屉只保留消息入口，不再有更新记录。
    await expect(navigation.getByRole("button", { name: /^更新记录/ })).toHaveCount(0);
    const messages = navigation.getByRole("button", { name: /消息（.*未读）/ });
    await messages.click();
    const messagesPanel = page.getByRole("dialog", { name: "消息中心" });
    await expect(messagesPanel).toBeVisible();
    await expect(messagesPanel).toHaveCSS("width", `${Math.min(640, width)}px`);
    await expect(page.locator(".drawer__backdrop").last()).toHaveCSS("opacity", "1");
    await expect(messagesPanel.getByText("暂无消息")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(messagesPanel).toBeHidden();
    await expect(messages).toBeFocused();
    await messages.click();
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

    // 按下才展开菜单：桌面在头像下方，手机在抽屉底部入口上方；悬停不展开。
    await trigger.hover();
    await expect(menu).toHaveCount(0);
    await trigger.click();
    await expect(menu).toBeVisible();
    const popover = page.locator(".account-menu");
    await expect(popover).not.toHaveAttribute("data-entering", "true");
    const [menuBox, triggerBox] = [await popover.boundingBox(), await trigger.boundingBox()];
    if (desktop)
      expect(menuBox?.y ?? 0).toBeGreaterThanOrEqual(
        (triggerBox?.y ?? 0) + (triggerBox?.height ?? 0),
      );
    else expect((menuBox?.y ?? 0) + (menuBox?.height ?? 0)).toBeLessThanOrEqual(triggerBox?.y ?? 0);
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
    // 充值弹窗沿用共享毛玻璃，不能回退到旧的实底材质。
    await expect(recharge).toHaveCSS("backdrop-filter", /blur\(/);
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
    await expect(settings.locator(".settings-hero-meta")).toContainText("UID 0123456789");
    await expect(page).toHaveURL(/\/commerce\/create$/);
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

test.describe("touch", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("tapping the capsule opens the menu and a row opens the account center", async ({
    page,
  }) => {
    await signIn(page, "touch-fixture");
    await page.goto("/commerce/create");
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
    await expect(page).toHaveURL(/\/commerce\/create$/);
  });
});

/** 等页面收到指定事件后逐帧记录消息面板的位置和遮罩不透明度，直到面板卸载。 */
function sampleDrawer(page: Page, eventType: "click" | "keydown") {
  return page.evaluate(async (type) => {
    await new Promise<void>((resolve) =>
      document.addEventListener(type, () => resolve(), { once: true, capture: true }),
    );
    const samples: { left: number; opacity: string }[] = [];
    const start = performance.now();
    while (performance.now() - start < 800) {
      await new Promise(requestAnimationFrame);
      const panel = document.querySelector(".account-news-panel");
      const backdrop = document.querySelector(".account-news-backdrop");
      if (panel && backdrop)
        samples.push({
          left: panel.getBoundingClientRect().left,
          opacity: getComputedStyle(backdrop).opacity,
        });
      else if (samples.length) break;
    }
    return samples;
  }, eventType);
}

test("message drawer slides as solid glass and closes from where it is", async ({ page }) => {
  await signIn(page, "13800138000");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/commerce/create");
  const opener = page.getByRole("button", { name: /消息（.*未读）/ });
  const panel = page.getByRole("dialog", { name: "消息中心" });
  // 遮罩全程保持不透明：面板是它的子元素，遮罩半透明会让毛玻璃透出清晰页面、结束时才突然变磨砂。
  const opening = sampleDrawer(page, "click");
  await opener.click();
  const enter = await opening;
  expect(enter.some((sample) => sample.left > 801)).toBe(true);
  expect(enter.at(-1)?.left).toBeCloseTo(800, 0);
  expect(enter.every((sample) => sample.opacity === "1")).toBe(true);
  // 关闭是看得见的滑出，不是跟着遮罩一起淡没。
  const closing = sampleDrawer(page, "keydown");
  await page.keyboard.press("Escape");
  const exit = await closing;
  expect(exit.some((sample) => sample.left > 900 && sample.left < 1440)).toBe(true);
  expect(exit.every((sample) => sample.opacity === "1")).toBe(true);
  await expect(panel).toBeHidden();

  // 进场停在 120ms 时关闭：从当前位置滑出，不先跳回完全打开的位置，也不瞬间消失。
  await opener.click();
  await expect(panel).toBeVisible();
  await page.evaluate(() => {
    const entering = document.querySelector(".account-news-content")?.getAnimations() ?? [];
    if (!entering.length) throw new Error("The drawer finished entering before the check");
    for (const animation of entering) {
      animation.pause();
      animation.currentTime = 120;
    }
  });
  const closingEarly = sampleDrawer(page, "keydown");
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    for (const animation of document.querySelector(".account-news-content")?.getAnimations() ?? [])
      animation.play();
  });
  const early = await closingEarly;
  expect(early.some((sample) => sample.left < 1440)).toBe(true);
  expect(early.every((sample) => sample.left > 820)).toBe(true);
  await expect(panel).toBeHidden();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await opener.click();
  await expect(panel).toHaveCSS("transition-duration", "0s");
  await expect(panel).toHaveCSS("translate", "none");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});

import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

for (const width of [390, 1440, 1920, 2560]) {
  test(`account overlays keep the shell steady and release the lock at ${width}px`, async ({
    page,
  }) => {
    await mockImageApi(page);
    const account = {
      userId: crypto.randomUUID(),
      organizationId: crypto.randomUUID(),
      role: "admin",
      account: "layout-fixture",
    };
    await page.route("**/api/v1/auth/session", (route) =>
      route.fulfill({ json: apiFixture(account) }),
    );
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const mobile = width < 768;
    const scrollable = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight,
    );
    // The homepage may be shorter than the viewport; only exercise scrolling
    // when there is content to scroll.
    if (scrollable) {
      await page.mouse.move(Math.round(width / 2), 500);
      await page.mouse.wheel(0, 120);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
      // 离开顶部后顶部栏按 vidmuse 收窄 4px（300ms 过渡），等它稳定后再取基准位置。
      await expect
        .poll(() => page.locator(".topbar").evaluate((el) => el.getBoundingClientRect().height))
        .toBe(mobile ? 56 : 60);
    }
    if (mobile) {
      const menuButton = await page.locator(".mobile-menu").boundingBox();
      expect(menuButton?.x).toBeCloseTo(12, 0);
      // Signed in, the account lives at the foot of the navigation drawer on phones.
      await page.getByRole("button", { name: "打开导航", exact: true }).click();
    }
    const trigger = page.getByRole("button", { name: `账户菜单：${account.account}`, exact: true });
    await expect(trigger).toBeVisible({ timeout: 15000 });
    // 桌面账户入口在顶部栏右侧只显示头像；手机在导航抽屉底部显示头像与昵称。
    await expect(trigger.locator(".account-trigger-name")).toHaveCount(mobile ? 1 : 0);
    if (mobile) await expect(page.locator(".topbar .account-trigger")).toBeHidden();
    const measure = () =>
      page.evaluate((mobile) => {
        const left = document.querySelector<HTMLElement>(
          mobile ? ".mobile-nav" : ".topbar .lycobo-logo",
        );
        const capsule = document.querySelector<HTMLElement>(
          mobile ? ".mobile-nav .account-trigger" : ".topbar .account-trigger",
        );
        if (!left || !capsule) throw new Error("Shell edges not found");
        return {
          left: left.getBoundingClientRect().left,
          capsule: capsule.getBoundingClientRect().toJSON(),
          scrollbar: innerWidth - document.documentElement.clientWidth,
        };
      }, mobile);
    // 抽屉滑入结束后再取基准位置，避免量到动画中途的坐标。
    if (mobile)
      await expect
        .poll(async () => (await page.locator(".mobile-nav").boundingBox())?.x ?? -1)
        .toBeCloseTo(0, 0);
    const baseline = await measure();
    // 桌面顶部栏左右内边距按 vidmuse 为 12px。
    expect(baseline.left).toBeCloseTo(mobile ? 0 : 12, 0);
    expect(baseline.scrollbar).toBe(0);
    await trigger.click();
    const menu = page.getByRole("dialog", { name: `账户菜单：${account.account}`, exact: true });
    await expect(menu).toBeVisible();
    expect(await measure()).toEqual(baseline);
    // 按坐标点击：Playwright 的 locator.click 会先自行滚动页面，顶部栏随之进入滚动状态而收窄，干扰这里的位移比较。
    const settings = await menu.getByRole("button", { name: "设置", exact: true }).boundingBox();
    if (!settings) throw new Error("Missing settings item");
    await page.mouse.click(settings.x + settings.width / 2, settings.y + settings.height / 2);
    const dialog = page.getByRole("dialog", { name: "账户设置", exact: true });
    await expect(dialog).toBeVisible();
    expect(await measure()).toEqual(baseline);
    await dialog.getByRole("button", { name: "关闭账户设置", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(await measure()).toEqual(baseline);
    await expect(trigger).toBeFocused();
    if (mobile) {
      await page.getByRole("button", { name: "关闭导航", exact: true }).click();
      await expect(page.locator(".mobile-nav")).toHaveCount(0);
    }
    // Closing the overlays must not leave the document locked against further scrolling.
    if (scrollable) {
      await page.mouse.move(Math.round(width / 2), 500);
      const afterCloseScroll = await page.evaluate(() => scrollY);
      await page.mouse.wheel(0, afterCloseScroll > 0 ? -120 : 120);
      await expect.poll(() => page.evaluate(() => scrollY)).not.toBe(afterCloseScroll);
    } else {
      await expect
        .poll(() =>
          page.evaluate(() => {
            const html = getComputedStyle(document.documentElement);
            const body = getComputedStyle(document.body);
            return html.overflow !== "hidden" && body.overflow !== "hidden";
          }),
        )
        .toBe(true);
    }
  });
}

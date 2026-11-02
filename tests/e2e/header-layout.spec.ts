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
    }
    if (mobile) {
      const menuButton = await page.locator(".mobile-menu").boundingBox();
      expect(menuButton?.x).toBeCloseTo(12, 0);
      // Signed in, the account lives at the foot of the navigation drawer on phones.
      await page.getByRole("button", { name: "打开导航", exact: true }).click();
    }
    const trigger = page.getByRole("button", { name: `账户菜单：${account.account}`, exact: true });
    await expect(trigger).toBeVisible({ timeout: 15000 });
    // Measure after the independently loaded wallet replaces its placeholder.
    await expect(trigger.locator("strong")).toHaveText("200");
    await expect(page.locator(".topbar .account-trigger")).toHaveCount(0);
    const measure = () =>
      page.evaluate((mobile) => {
        const left = document.querySelector<HTMLElement>(
          mobile ? ".mobile-nav" : ".sidebar .lycobo-logo",
        );
        const capsule = document.querySelector<HTMLElement>(
          mobile ? ".mobile-nav .account-trigger" : ".sidebar .account-trigger",
        );
        if (!left || !capsule) throw new Error("Shell edges not found");
        return {
          left: left.getBoundingClientRect().left,
          capsule: capsule.getBoundingClientRect().toJSON(),
          scrollbar: innerWidth - document.documentElement.clientWidth,
        };
      }, mobile);
    const baseline = await measure();
    expect(baseline.left).toBeCloseTo(mobile ? 0 : 20, 0);
    expect(baseline.scrollbar).toBe(0);
    await trigger.click();
    const menu = page.getByRole("menu", { name: `账户菜单：${account.account}`, exact: true });
    await expect(menu).toBeVisible();
    expect(await measure()).toEqual(baseline);
    await menu.getByRole("menuitem", { name: "个人信息", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "个人信息", exact: true });
    await expect(dialog).toBeVisible();
    expect(await measure()).toEqual(baseline);
    await dialog.getByRole("button", { name: "关闭个人信息", exact: true }).click();
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

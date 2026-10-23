import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

for (const width of [390, 1440, 1920, 2560]) {
  test(`account overlays keep the header steady and release the lock at ${width}px`, async ({
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
    const trigger = page.getByRole("button", { name: `账户菜单：${account.account}`, exact: true });
    await expect(trigger).toBeVisible();
    // Measure after the independently loaded wallet replaces its placeholder.
    await expect(trigger.locator("strong")).toHaveText("200");
    const measure = () =>
      page.evaluate((mobile) => {
        const left = document.querySelector<HTMLElement>(
          mobile ? ".mobile-menu" : ".sidebar .lycobo-logo",
        );
        const right = document.querySelector<HTMLElement>(".account-trigger");
        if (!left || !right) throw new Error("Header edges not found");
        return {
          left: left.getBoundingClientRect().left,
          right: innerWidth - right.getBoundingClientRect().right,
          triggerX: right.getBoundingClientRect().x,
          scrollbar: innerWidth - document.documentElement.clientWidth,
        };
      }, width < 768);
    const baseline = await measure();
    expect(baseline.left).toBeCloseTo(width < 768 ? 12 : 20, 0);
    expect(baseline.right).toBeCloseTo(baseline.left, 0);
    expect(baseline.scrollbar).toBe(0);
    // The homepage may be shorter than the viewport; only exercise scrolling
    // when there is content to scroll.
    const scrollable = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight,
    );
    if (scrollable) {
      await page.mouse.move(Math.round(width / 2), 500);
      await page.mouse.wheel(0, 120);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
    }
    await trigger.hover();
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
    // Closing a modal must not leave the home document locked against further scrolling.
    await expect(trigger).toBeFocused();
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

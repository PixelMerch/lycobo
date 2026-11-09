import { expect, type Locator, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

async function glass(panel: Locator) {
  await expect(panel).toBeVisible();
  await expect
    .poll(() => panel.evaluate((node) => getComputedStyle(node).backdropFilter))
    .toContain("blur(28px)");
  await expect
    .poll(() => panel.evaluate((node) => getComputedStyle(node).backgroundImage))
    .toContain("linear-gradient");
}
for (const mobile of [false, true]) {
  test(`credits menu uses the vidmuse header surface and keeps draft and focus ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await mockImageApi(page);
    if (mobile) await page.setViewportSize({ width: 393, height: 852 });
    await page.goto("/");
    const draft = page.getByRole("textbox", { name: "创作需求", exact: true });
    await draft.fill("关闭积分菜单后保留草稿");
    const credits = page.locator(".header-credits");
    // 积分胶囊按 vidmuse：#FFFFFF14 底、不加背景模糊。
    await expect(credits).toHaveCSS("background-color", "rgba(255, 255, 255, 0.08)");
    await expect(credits).toHaveCSS("backdrop-filter", "none");
    await credits.focus();
    await page.keyboard.press("Enter");
    const menu = page.locator(".credits-menu");
    // 顶部栏下拉是具名例外：#FFFFFF14 底与 40px 背景模糊，不叠共享玻璃的描边与渐变。
    await expect(menu).toHaveCSS("background-color", "rgba(255, 255, 255, 0.08)");
    await expect(menu).toHaveCSS("backdrop-filter", "blur(40px)");
    await expect(menu).toHaveCSS("border-top-width", "0px");
    await expect(page.getByRole("menuitem", { name: "去订阅", exact: true })).toBeVisible();
    await expect(page.getByRole("menu")).toHaveCSS("outline-style", "none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `/tmp/lycobo-credits-menu-${mobile ? "mobile" : "desktop"}.png`,
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
    });
    await expect(menu).toHaveCSS("backdrop-filter", "none");
    await expect(menu).toHaveCSS("background-color", "rgb(28, 31, 27)");
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(credits).toBeFocused();
    await expect(draft).toHaveValue("关闭积分菜单后保留草稿");
  });
  test(`message center uses readable glass and retains read actions ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await mockImageApi(page);
    const messages = [
      {
        id: crypto.randomUUID(),
        title: "图片生成完成",
        body: "任务 W12345678 已更新，可在工作台查看结果。",
        createdAt: "2026-11-06T06:03:44Z",
        read: false,
      },
      {
        id: crypto.randomUUID(),
        title: "任务与消息实时同步",
        body: "任务状态与消息已支持实时同步。",
        createdAt: "2026-11-06T05:00:00Z",
        read: true,
      },
    ];
    await page.route("**/api/v1/notifications*", (route) =>
      route.fulfill({
        json: apiFixture({
          data: messages,
          unread: messages.filter((m) => !m.read).length,
          nextCursor: null,
        }),
      }),
    );
    await page.route("**/api/v1/notifications/*/read", async (route) => {
      const first = messages[0];
      if (first) first.read = true;
      await route.fulfill({ json: apiFixture({}) });
      await page.evaluate(() =>
        window.dispatchEvent(
          new CustomEvent("fixture:realtime", {
            detail: { type: "image.updated", id: "1", data: { kind: "notification" } },
          }),
        ),
      );
    });
    if (mobile) await page.setViewportSize({ width: 393, height: 852 });
    await page.goto("/");
    if (mobile) await page.getByRole("button", { name: "打开导航", exact: true }).click();
    const opener = page.getByRole("button", { name: /^消息（/ });
    await opener.click();
    const panel = page.getByRole("dialog", { name: "消息中心", exact: true });
    await glass(panel);
    await expect(panel.getByText("1 条未读消息", { exact: true })).toBeVisible();
    await expect(panel.getByRole("heading", { name: "桌面通知", exact: true })).toBeVisible();
    await expect(panel.locator('.account-message[data-unread="true"]')).toHaveCount(1);
    await expect(panel.getByRole("button", { name: "标为已读", exact: true })).toHaveCount(1);
    await panel.screenshot({
      path: `/tmp/lycobo-glass-messages-${mobile ? "mobile" : "desktop"}.png`,
      animations: "disabled",
    });
    await expect
      .poll(() => panel.evaluate((node) => node.scrollWidth <= node.clientWidth))
      .toBe(true);
    await panel.getByRole("button", { name: "标为已读", exact: true }).click();
    await expect(panel.locator('.account-message[data-unread="true"]')).toHaveCount(0);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
    });
    await expect
      .poll(() => panel.evaluate((node) => getComputedStyle(node).backdropFilter))
      .toBe("none");
    await panel.getByRole("button", { name: "关闭消息中心", exact: true }).click();
    await expect(opener).toBeFocused();
  });
}
test("login adopts dark glass without changing form semantics", async ({ page }) => {
  await mockImageApi(page, { signedIn: false });
  await page.goto("/");
  await page.getByRole("button", { name: "登录领积分", exact: true }).click();
  await glass(page.locator(".login-panel"));
  await expect(page.locator(".login-page")).toBeVisible();
  await page.screenshot({ path: "/tmp/lycobo-glass-login.png", animations: "disabled" });
});

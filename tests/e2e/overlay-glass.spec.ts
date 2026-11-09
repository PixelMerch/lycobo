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
  test(`credit overview retains glass, draft and focus ${mobile ? "mobile" : "desktop"}`, async ({
    page,
  }) => {
    await mockImageApi(page);
    if (mobile) await page.setViewportSize({ width: 393, height: 852 });
    await page.goto("/");
    const draft = page.getByRole("textbox", { name: "创作需求", exact: true });
    await draft.fill("关闭积分概览后保留草稿");
    const balance = page.locator(".header-balance");
    await glass(page.locator(".header-benefits"));
    await balance.click();
    const panel = page.getByRole("dialog", { name: "积分概览", exact: true });
    await glass(page.locator(".credit-preview-popover"));
    await expect(panel.getByRole("button", { name: "充值积分", exact: true })).toBeVisible();
    await expect(panel).toHaveCSS("outline-style", "none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `/tmp/lycobo-glass-credits-${mobile ? "mobile" : "desktop"}.png`,
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
    });
    await expect(page.locator(".credit-preview-popover")).toHaveCSS("backdrop-filter", "none");
    await expect(page.locator(".header-benefits")).toHaveCSS("backdrop-filter", "none");
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(balance).toBeFocused();
    await expect(draft).toHaveValue("关闭积分概览后保留草稿");
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

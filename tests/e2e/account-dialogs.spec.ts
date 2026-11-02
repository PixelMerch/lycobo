import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

for (const width of [1440, 390]) {
  test(`account management uses neutral fields and truthful disabled actions at ${width}px`, async ({
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
          account: "merchant-fixture",
        }),
      }),
    );
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && !request.url().endsWith("/api/v1/image-session"))
        writes.push(request.url());
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/create");
    // Phones reach the account from the foot of the navigation drawer.
    if (width < 768) await page.getByRole("button", { name: "打开导航", exact: true }).click();
    const trigger = page.getByRole("button", { name: "账户菜单：merchant-fixture", exact: true });
    await trigger.click();
    await page.getByRole("menuitem", { name: "账号管理", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "账号管理", exact: true });
    // On phones the navigation drawer stays open beneath the account dialog.
    await expect(page.getByRole("dialog")).toHaveCount(width < 768 ? 2 : 1);
    await expect(page.locator(".modal__backdrop")).not.toHaveAttribute("data-entering", "true");
    await expect(dialog.getByRole("button", { name: "绑定手机号", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "绑定邮箱", exact: true })).toBeDisabled();
    await expect(dialog.getByText("账号 0123456789", { exact: true })).toBeVisible();
    await page.screenshot({ path: `/tmp/lycobo-account-bindings-${width}.png` });
    await dialog.getByRole("tab", { name: "重置密码", exact: true }).click();
    const account = dialog.getByRole("textbox", { name: "企业账号", exact: true });
    await expect(account).toHaveValue("merchant-fixture");
    await expect(account).toHaveAttribute("readonly", "");
    await account.focus();
    await expect(account).toHaveCSS("outline-color", "rgb(161, 161, 170)");
    await expect(account).toHaveCSS("box-shadow", "none");
    await expect(dialog.getByRole("button", { name: "发送验证码", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "确认", exact: true })).toBeDisabled();
    await expect(dialog.getByLabel("验证码", { exact: true })).toBeDisabled();
    expect(writes).toEqual([]);
    await page.screenshot({ path: `/tmp/lycobo-account-reset-${width}.png` });
    const box = await dialog.boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await dialog.getByRole("button", { name: "取消", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}

test("ledger filters loaded pages without losing older records or exposing payment actions", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: apiFixture({
        userId: crypto.randomUUID(),
        organizationId: crypto.randomUUID(),
        role: "admin",
        account: "ledger-fixture",
      }),
    }),
  );
  const makeEntry = (id: number, refund = false) => ({
    id: String(id),
    user_uid: "0123456789",
    kind: refund ? "refund" : "consume",
    amount: refund ? 20 : -20,
    balance_after: 200,
    job_id: crypto.randomUUID(),
    task_id: "W12345678",
    item_id: crypto.randomUUID(),
    recharge_id: null,
    created_at: "2026-10-22T00:00:00Z",
  });
  const recent = Array.from({ length: 20 }, (_, index) => makeEntry(30 - index));
  const older = { ...makeEntry(10, true), created_at: "2026-10-21T00:00:00Z" };
  await page.route("**/api/v1/wallet/entries?*", (route) =>
    route.fulfill({
      json: apiFixture({
        data: new URL(route.request().url()).searchParams.has("before") ? [older] : recent,
      }),
    }),
  );
  await page.goto("/create");
  await page.locator(".account-trigger").click();
  await page.getByRole("menuitem", { name: "订阅与账单", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "订阅与账单", exact: true });
  await expect(dialog.getByText("已加载 20 条记录", { exact: true })).toBeVisible();
  await dialog.locator(".infinite-load").scrollIntoViewIfNeeded();
  await expect(dialog.getByText("已加载 21 条记录", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "2026年10月22日" })).toBeAttached();
  await expect(dialog.getByRole("heading", { name: "2026年10月21日" })).toBeVisible();
  await dialog.locator(".modal__body").evaluate((el) => {
    el.scrollTop = 0;
  });
  await dialog.screenshot({ path: "/tmp/lycobo-billing-redesign-records.png" });
  await dialog.getByRole("button", { name: /全部类型.*收支类型/ }).click();
  await page.getByRole("option", { name: "生成失败退款", exact: true }).click();
  await expect(
    dialog.getByRole("region", { name: "积分收支明细", exact: true }).getByRole("listitem"),
  ).toHaveCount(1);
  await expect(dialog.getByText("+20 积分", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "加载更多收支", exact: true })).toHaveCount(0);
  await page.screenshot({ path: "/tmp/lycobo-account-ledger-desktop.png" });
  await dialog.getByRole("tab", { name: "充值订单", exact: true }).click();
  await expect(dialog.getByText("暂无订单记录", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({ path: "/tmp/lycobo-account-orders-mobile.png" });
});

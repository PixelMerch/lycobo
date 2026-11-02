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
const entry = (id: number, overrides: Record<string, unknown> = {}) => ({
  id: String(id),
  user_uid: "0123456789",
  kind: "consume",
  amount: -2,
  balance_after: 200,
  job_id: crypto.randomUUID(),
  task_id: "W12345678",
  item_id: crypto.randomUUID(),
  recharge_id: null,
  created_at: "2026-10-22T00:00:00Z",
  ...overrides,
});

for (const width of [1440, 390]) {
  test(`account security uses neutral fields and truthful disabled actions at ${width}px`, async ({
    page,
  }) => {
    await signIn(page, "merchant-fixture");
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && !request.url().endsWith("/api/v1/image-session"))
        writes.push(request.url());
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/account/security");
    const panel = page.getByRole("tabpanel", { name: "账号与安全", exact: true });
    await expect(panel.getByText("merchant-fixture", { exact: true }).first()).toBeVisible();
    await expect(panel.getByRole("button", { name: "绑定手机号", exact: true })).toBeDisabled();
    await expect(panel.getByRole("button", { name: "绑定邮箱", exact: true })).toBeDisabled();
    await expect(panel.getByText("UID 0123456789", { exact: true })).toBeVisible();
    await panel.getByRole("tab", { name: "重置密码", exact: true }).click();
    const account = panel.getByRole("textbox", { name: "企业账号", exact: true });
    await expect(account).toHaveValue("merchant-fixture");
    await expect(account).toHaveAttribute("readonly", "");
    await account.focus();
    await expect(account).toHaveCSS("outline-color", "rgb(161, 161, 170)");
    await expect(account).toHaveCSS("box-shadow", "none");
    await expect(panel.getByRole("button", { name: "发送验证码", exact: true })).toBeDisabled();
    await expect(panel.getByRole("button", { name: "确认", exact: true })).toBeDisabled();
    await expect(panel.getByLabel("验证码", { exact: true })).toBeDisabled();
    expect(writes).toEqual([]);
    await page.screenshot({ path: `/tmp/lycobo-account-security-${width}.png` });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  });
}

test("overview summarizes the real balance, records and works without inventing membership", async ({
  page,
}) => {
  await signIn(page, "overview-fixture");
  await page.route("**/api/v1/wallet/entries?*", (route) =>
    route.fulfill({
      json: apiFixture({
        data: [entry(3), entry(2, { kind: "refund", amount: 2 }), entry(1)],
      }),
    }),
  );
  await page.goto("/account");
  const overview = page.getByRole("tabpanel", { name: "概览", exact: true });
  const wallet = overview.getByRole("region", { name: "企业共享积分" });
  // 200 credits at 2 per image: the page states the whole images, never a rounded-up count.
  await expect(wallet.locator(".account-balance")).toHaveText("200");
  await expect(wallet).toContainText("约可生成 100 张");
  await expect(overview.getByRole("region", { name: "会员" })).toContainText("暂未开通");
  await expect(
    overview.getByRole("region", { name: "最近积分记录" }).getByRole("listitem"),
  ).toHaveCount(3);
  await expect(overview.getByText("暂无作品，", { exact: false })).toBeVisible();
  await overview.getByRole("button", { name: "充值积分", exact: true }).click();
  const recharge = page.getByRole("dialog", { name: "充值积分", exact: true });
  // The order preview adds the default 500-credit pack to the real balance.
  await expect(recharge.locator(".credit-order-after strong")).toContainText("200");
  await expect(recharge.locator(".credit-order-after strong")).toContainText("700");
  await expect(recharge.getByRole("button", { name: "立即购买", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(recharge).toHaveCount(0);
  await expect(overview.getByRole("button", { name: "充值积分", exact: true })).toBeFocused();
  await page.screenshot({ path: "/tmp/lycobo-account-overview.png" });
});

test("ledger filters loaded pages without losing older records or exposing payment actions", async ({
  page,
}) => {
  await signIn(page, "ledger-fixture");
  const recent = Array.from({ length: 20 }, (_, index) => entry(30 - index, { amount: -20 }));
  const older = entry(10, { kind: "refund", amount: 20, created_at: "2026-10-21T00:00:00Z" });
  await page.route("**/api/v1/wallet/entries?*", (route) =>
    route.fulfill({
      json: apiFixture({
        data: new URL(route.request().url()).searchParams.has("before") ? [older] : recent,
      }),
    }),
  );
  await page.goto("/account/credits");
  const toolbar = page.locator(".account-ledger .account-toolbar");
  await expect(toolbar).toContainText("已加载 20 条");
  await page.locator(".account-ledger .infinite-load").scrollIntoViewIfNeeded();
  await expect(toolbar).toContainText("已加载 21 条");
  const table = page.getByRole("grid", { name: "积分收支明细", exact: true });
  const rows = table.locator(".table__body .table__row");
  await expect(rows).toHaveCount(21);
  await page
    .getByRole("radiogroup", { name: "收支类型", exact: true })
    .getByRole("radio", { name: "失败退款", exact: true })
    .click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("+20");
  await expect(page.getByRole("button", { name: /加载更多|购买|支付/ })).toHaveCount(0);
  await page.screenshot({ path: "/tmp/lycobo-account-ledger-desktop.png" });
  await page.getByRole("tab", { name: "充值订单", exact: true }).click();
  await expect(page).toHaveURL(/\/account\/orders$/);
  await expect(page.getByText("暂无充值订单", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({ path: "/tmp/lycobo-account-orders-mobile.png" });
});

for (const width of [1440, 390]) {
  test(`account tabs are routes that keep the tab row steady at ${width}px`, async ({ page }) => {
    await signIn(page, "tabs-fixture");
    await page.setViewportSize({ width, height: width < 768 ? 700 : 900 });
    await page.goto("/account/unknown");
    await expect(page).toHaveURL(/\/account$/);
    const tabs = page.getByRole("tablist", { name: "个人中心", exact: true });
    const before = await tabs.boundingBox();
    if (!before) throw new Error("Missing account tabs");
    for (const [name, path] of [
      ["积分明细", "/account/credits"],
      ["充值订单", "/account/orders"],
      ["会员", "/account/membership"],
      ["账号与安全", "/account/security"],
    ] as const) {
      await tabs.getByRole("tab", { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(tabs.getByRole("tab", { name, exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect((await tabs.boundingBox())?.y).toBeCloseTo(before.y, 0);
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
    }
    await page.goBack();
    await expect(page).toHaveURL(/\/account\/membership$/);
    await expect(tabs.getByRole("tab", { name: "会员", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
}

test("signed-out visitors see a login prompt instead of an empty account center", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.goto("/account/credits");
  await expect(page.getByRole("heading", { name: "登录后查看个人中心" })).toBeVisible();
  await expect(page.getByRole("button", { name: "登录", exact: true })).toBeVisible();
  await expect(page.getByRole("tablist")).toHaveCount(0);
});

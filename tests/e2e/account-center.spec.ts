import { expect, type Locator, type Page, test } from "@playwright/test";
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

/** The account center is a dialog over the current page; menu rows open it on their tab. */
async function openCenter(page: Page, account: string, row: string) {
  if ((page.viewportSize()?.width ?? 1440) < 768)
    await page.getByRole("button", { name: "打开导航", exact: true }).click();
  await page.getByRole("button", { name: `账户菜单：${account}`, exact: true }).click();
  await page.getByRole("menuitem", { name: row, exact: true }).click();
  const center = page.getByRole("dialog", { name: "个人中心", exact: true });
  await expect(center).toBeVisible();
  // Measure only after the opening zoom has settled.
  await expect(page.locator(".modal__container").filter({ has: center })).not.toHaveAttribute(
    "data-entering",
    "true",
  );
  return center;
}

async function expectInsideViewport(page: Page, center: Locator) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Missing viewport");
  // React Aria updates its visual viewport height after the resize event.
  await expect
    .poll(async () => {
      const box = await center.boundingBox();
      return (
        !!box &&
        box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= viewport.width &&
        box.y + box.height <= viewport.height
      );
    })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
}

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
    await page.goto("/create");
    const center = await openCenter(page, "merchant-fixture", "账号与安全");
    // The center never becomes a page: the workspace URL stays as it was.
    await expect(page).toHaveURL(/\/create$/);
    const panel = center.getByRole("tabpanel", { name: "账号与安全", exact: true });
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
    await expectInsideViewport(page, center);
  });
}

test("overview summarizes real data and stacks recharge above the center", async ({ page }) => {
  await signIn(page, "overview-fixture");
  await page.route("**/api/v1/wallet/entries?*", (route) =>
    route.fulfill({
      json: apiFixture({
        data: [entry(3), entry(2, { kind: "refund", amount: 2 }), entry(1)],
      }),
    }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/create");
  const draft = page.getByLabel(/^(提示词|制作要求)$/, { exact: true });
  await draft.fill("保留正在准备的商品图");
  const trigger = page.getByRole("button", { name: "账户菜单：overview-fixture", exact: true });
  const center = await openCenter(page, "overview-fixture", "个人中心");
  const overview = center.getByRole("tabpanel", { name: "概览", exact: true });
  const wallet = overview.getByRole("region", { name: "企业共享积分" });
  // 200 credits at 2 per image: the center states the whole images, never a rounded-up count.
  await expect(wallet.locator(".account-balance")).toHaveText("200");
  await expect(wallet).toContainText("约可生成 100 张");
  await expect(overview.getByRole("region", { name: "会员" })).toContainText("暂未开通");
  await expect(
    overview.getByRole("region", { name: "最近积分记录" }).getByRole("listitem"),
  ).toHaveCount(3);
  await expect(overview.getByText("暂无作品，", { exact: false })).toBeVisible();
  await page.screenshot({ path: "/tmp/lycobo-account-overview.png" });

  // Recharge opens above the center; Escape closes only the top dialog.
  await overview.getByRole("button", { name: "充值积分", exact: true }).click();
  const recharge = page.getByRole("dialog", { name: "充值积分", exact: true });
  // The order preview adds the default 500-credit pack to the real balance.
  await expect(recharge.locator(".credit-order-after strong")).toContainText("200");
  await expect(recharge.locator(".credit-order-after strong")).toContainText("700");
  await expect(recharge.getByRole("button", { name: "立即购买", exact: true })).toBeDisabled();
  await page.keyboard.press("Tab");
  await expect(recharge.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(recharge).toHaveCount(0);
  await expect(center).toBeVisible();
  await expect(overview.getByRole("button", { name: "充值积分", exact: true })).toBeFocused();

  // In-panel shortcuts switch tabs inside the dialog and keep focus on the selected tab.
  await overview.getByRole("button", { name: "全部明细" }).click();
  const ledgerTab = center.getByRole("tab", { name: "积分明细", exact: true });
  await expect(ledgerTab).toHaveAttribute("aria-selected", "true");
  await expect(ledgerTab).toBeFocused();
  await expect(page).toHaveURL(/\/create$/);
  await page.keyboard.press("Escape");
  await expect(center).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(draft).toHaveValue("保留正在准备的商品图");

  // Links to other pages close the center before the page changes.
  await openCenter(page, "overview-fixture", "个人中心");
  await center.getByRole("link", { name: "进入素材库" }).click();
  await expect(page).toHaveURL(/\/assets$/);
  await expect(center).toHaveCount(0);
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
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/create");
  const center = await openCenter(page, "ledger-fixture", "积分明细");
  const toolbar = center.locator(".account-ledger .account-toolbar");
  await expect(toolbar).toContainText("已加载 20 条");
  // Only the tab panel scrolls; reaching its end loads older records.
  await center.locator(".account-ledger .infinite-load").scrollIntoViewIfNeeded();
  await expect(toolbar).toContainText("已加载 21 条");
  const table = center.getByRole("grid", { name: "积分收支明细", exact: true });
  const rows = table.locator(".table__body .table__row");
  await expect(rows).toHaveCount(21);
  await center
    .getByRole("radiogroup", { name: "收支类型", exact: true })
    .getByRole("radio", { name: "失败退款", exact: true })
    .click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("+20");
  await expect(center.getByRole("button", { name: /加载更多|购买|支付/ })).toHaveCount(0);
  await page.screenshot({ path: "/tmp/lycobo-account-ledger-desktop.png" });
  await center.getByRole("tab", { name: "充值订单", exact: true }).click();
  await expect(center.getByText("暂无充值订单", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectInsideViewport(page, center);
  await page.screenshot({ path: "/tmp/lycobo-account-orders-mobile.png" });
});

for (const width of [1440, 390]) {
  test(`switching tabs keeps the dialog and its tab row steady at ${width}px`, async ({ page }) => {
    await signIn(page, "tabs-fixture");
    await page.setViewportSize({ width, height: width < 768 ? 700 : 900 });
    await page.goto("/create");
    const center = await openCenter(page, "tabs-fixture", "个人中心");
    const tabs = center.getByRole("tablist", { name: "个人中心", exact: true });
    await expect(tabs.getByRole("tab", { name: "概览", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const [frame, row] = [await center.boundingBox(), await tabs.boundingBox()];
    if (!frame || !row) throw new Error("Missing account center bounds");
    for (const name of ["积分明细", "充值订单", "会员", "账号与安全", "概览"]) {
      await tabs.getByRole("tab", { name, exact: true }).click();
      await expect(tabs.getByRole("tab", { name, exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(page).toHaveURL(/\/create$/);
      const [nextFrame, nextRow] = [await center.boundingBox(), await tabs.boundingBox()];
      expect(nextFrame?.height).toBeCloseTo(frame.height, 0);
      expect(nextRow?.y).toBeCloseTo(row.y, 0);
      await expectInsideViewport(page, center);
    }
    await page.screenshot({ path: `/tmp/lycobo-account-center-${width}.png` });
  });
}

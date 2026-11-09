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
  const center = page.getByRole("dialog", { name: "积分与账单", exact: true });
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

test("personal center opens billing by default and preserves drafts and focus", async ({
  page,
}) => {
  await signIn(page, "billing-fixture");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/commerce/create");
  const draft = page.getByLabel(/^(提示词|制作要求)$/, { exact: true });
  await draft.fill("保留正在准备的商品图");
  const trigger = page.getByRole("button", { name: "账户菜单：billing-fixture", exact: true });
  const center = await openCenter(page, "billing-fixture", "积分与账单");
  const tabs = center.getByRole("tablist", { name: "积分与账单", exact: true });
  await expect(tabs.getByRole("tab")).toHaveText(["积分明细", "充值订单"]);
  await expect(tabs.getByRole("tab", { name: "积分明细", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(center.getByRole("region", { name: "积分明细", exact: true })).toBeVisible();
  await expect(center.locator(".account-profile-main")).toContainText("billing-fixture");
  await expect(center.locator(".account-profile-meta")).toContainText("UID 0123456789");
  await expect(center.getByRole("button", { name: "复制 UID", exact: true })).toBeVisible();
  await tabs.getByRole("tab", { name: "充值订单", exact: true }).click();
  await expect(center.getByText("暂无充值订单", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/commerce\/create$/);
  await page.keyboard.press("Escape");
  await expect(center).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(draft).toHaveValue("保留正在准备的商品图");
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
  await page.goto("/commerce/create");
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
    await page.goto("/commerce/create");
    const center = await openCenter(page, "tabs-fixture", "积分与账单");
    const tabs = center.getByRole("tablist", { name: "积分与账单", exact: true });
    await expect(tabs.getByRole("tab", { name: "积分明细", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const [frame, row] = [await center.boundingBox(), await tabs.boundingBox()];
    if (!frame || !row) throw new Error("Missing account center bounds");
    for (const name of ["充值订单", "积分明细"]) {
      await tabs.getByRole("tab", { name, exact: true }).click();
      await expect(tabs.getByRole("tab", { name, exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(page).toHaveURL(/\/commerce\/create$/);
      const [nextFrame, nextRow] = [await center.boundingBox(), await tabs.boundingBox()];
      expect(nextFrame?.height).toBeCloseTo(frame.height, 0);
      expect(nextRow?.y).toBeCloseTo(row.y, 0);
      await expectInsideViewport(page, center);
    }
    await page.screenshot({ path: `/tmp/lycobo-account-center-${width}.png` });
  });
}

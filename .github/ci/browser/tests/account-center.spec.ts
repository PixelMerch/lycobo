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
  job_id: crypto.randomUUID(),
  task_id: "W12345678",
  item_id: crypto.randomUUID(),
  recharge_id: null,
  created_at: "2026-10-22T00:00:00Z",
  ...overrides,
});

/** 从工作区头像进入账户设置，保持当前工作区地址。 */
async function openCenter(page: Page, account: string) {
  await page.getByRole("button", { name: `账户菜单：${account}`, exact: true }).click();
  await page.getByRole("button", { name: "设置", exact: true }).click();
  const center = page.getByRole("dialog", { name: "账户设置", exact: true });
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

test("personal center opens billing from settings and preserves drafts and focus", async ({
  page,
}) => {
  await signIn(page, "billing-fixture");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/zh-CN/dashboard/commerce/create");
  const draft = page.getByLabel(/^(提示词|制作要求)$/, { exact: true });
  await draft.fill("保留正在准备的商品图");
  const trigger = page.getByRole("button", { name: "账户菜单：billing-fixture", exact: true });
  const center = await openCenter(page, "billing-fixture");
  await expect(center.locator(".settings-identity-text")).toContainText("billing-fixture");
  await expect(center.locator(".settings-identity-text")).toContainText("UID 0123456789");
  await expect(center.getByRole("button", { name: "复制 UID", exact: true })).toBeVisible();
  await center.getByRole("tab", { name: "积分与账单", exact: true }).click();
  const views = center.getByRole("radiogroup", { name: "积分用量", exact: true });
  await expect(views.getByRole("radio")).toHaveText(["积分明细", "充值订单"]);
  await expect(views.getByRole("radio", { name: "积分明细", exact: true })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(center.getByRole("region", { name: "积分明细", exact: true })).toBeVisible();
  await views.getByRole("radio", { name: "充值订单", exact: true }).click();
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
  await page.route("**/api/v1/wallet/history?*", (route) =>
    route.fulfill({
      json: apiFixture(
        new URL(route.request().url()).searchParams.has("before")
          ? { data: [older], nextCursor: null }
          : { data: recent, nextCursor: "fixture-next" },
      ),
    }),
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/zh-CN/dashboard/commerce/create");
  const center = await openCenter(page, "ledger-fixture");
  await center.getByRole("tab", { name: "积分与账单", exact: true }).click();
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
  await center.getByRole("radio", { name: "充值订单", exact: true }).click();
  await expect(center.getByText("暂无充值订单", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectInsideViewport(page, center);
  await page.screenshot({ path: "/tmp/lycobo-account-orders-mobile.png" });
});

for (const width of [1440, 390]) {
  test(`switching tabs keeps the dialog and its tab row steady at ${width}px`, async ({ page }) => {
    await signIn(page, "tabs-fixture");
    await page.setViewportSize({ width, height: width < 768 ? 700 : 900 });
    await page.goto("/zh-CN/dashboard/commerce/create");
    const center = await openCenter(page, "tabs-fixture");
    await center.getByRole("tab", { name: "积分与账单", exact: true }).click();
    const views = center.getByRole("radiogroup", { name: "积分用量", exact: true });
    await expect(views.getByRole("radio", { name: "积分明细", exact: true })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    const [frame, row] = [await center.boundingBox(), await views.boundingBox()];
    if (!frame || !row) throw new Error("Missing account center bounds");
    for (const name of ["充值订单", "积分明细"]) {
      await views.getByRole("radio", { name, exact: true }).click();
      await expect(views.getByRole("radio", { name, exact: true })).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await expect(page).toHaveURL(/\/commerce\/create$/);
      const [nextFrame, nextRow] = [await center.boundingBox(), await views.boundingBox()];
      expect(nextFrame?.height).toBeCloseTo(frame.height, 0);
      expect(nextRow?.y).toBeCloseTo(row.y, 0);
      await expectInsideViewport(page, center);
    }
    await page.screenshot({ path: `/tmp/lycobo-account-center-${width}.png` });
  });
}

import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

test("enterprise account shows shared balance, member spending and recharge records", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: apiFixture({
        userId: crypto.randomUUID(),
        organizationId: crypto.randomUUID(),
        role: "admin",
        account: "enterprise-fixture",
      }),
    }),
  );
  const task = crypto.randomUUID();
  await page.route("**/api/v1/wallet/entries?*", (route) =>
    route.fulfill({
      json: apiFixture({
        data: [
          {
            id: "2",
            user_uid: "0123456789",
            kind: "consume",
            amount: -20,
            balance_after: 200,
            job_id: task,
            task_id: "W12345678",
            item_id: crypto.randomUUID(),
            recharge_id: null,
            created_at: "2026-10-21T00:00:00Z",
          },
        ],
      }),
    }),
  );
  await page.route("**/api/v1/wallet/recharges?*", (route) =>
    route.fulfill({
      json: apiFixture({
        data: [
          {
            id: crypto.randomUUID(),
            user_uid: "9876543210",
            credits: 220,
            amount_minor: 1000,
            currency: "CNY",
            status: "paid",
            channel: "fixture",
            created_at: "2026-10-20T00:00:00Z",
            paid_at: "2026-10-20T00:01:00Z",
          },
        ],
      }),
    }),
  );
  await page.goto("/create");
  await expect(page.locator(".header-balance")).toContainText("200");
  await page.locator(".account-trigger").click();
  await page.getByRole("menuitem", { name: "积分明细", exact: true }).click();
  await expect(page).toHaveURL(/\/account\/credits$/);
  const ledger = page.getByRole("region", { name: "积分明细", exact: true });
  await expect(ledger.locator(".account-toolbar-meta")).toContainText("当前可用 200 积分");
  const row = ledger.locator(".table__body .table__row");
  await expect(row).toHaveCount(1);
  // A shared wallet names the spending member; unknown members keep their UID.
  await expect(row).toContainText("UID 0123456789");
  await expect(row).toContainText("任务 W12345678");
  await expect(row).toContainText("-20");
  await page.screenshot({ path: "/tmp/lycobo-account-ledger-wallet.png" });
  await page.getByRole("tab", { name: "充值订单", exact: true }).click();
  const order = page.locator(".account-orders .table__body .table__row");
  await expect(order).toContainText("已到账");
  await expect(order).toContainText("¥10.00");
  // Unknown provider codes are shown as recorded instead of being renamed.
  await expect(order).toContainText("fixture");
  await page.getByRole("tab", { name: "概览", exact: true }).click();
  await expect(page.getByRole("button", { name: "充值积分", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: /查看会员方案/ })).toBeEnabled();
  await page.setViewportSize({ width: 320, height: 760 });
  await page.getByRole("tab", { name: "积分明细", exact: true }).click();
  await page.screenshot({ path: "/tmp/lycobo-account-ledger-mobile.png" });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

test("billing failures stay unknown and retry real reads", async ({ page }) => {
  await mockImageApi(page);
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: apiFixture({
        userId: crypto.randomUUID(),
        organizationId: crypto.randomUUID(),
        role: "admin",
        account: "billing-error-fixture",
      }),
    }),
  );
  await page.route("**/api/v1/wallet", (route) =>
    route.fulfill({ status: 503, json: apiFixture({}, 503) }),
  );
  let reads = 0;
  await page.route("**/api/v1/wallet/entries?*", (route) => {
    reads++;
    return route.fulfill({ status: 503, json: apiFixture({}, 503) });
  });
  await page.goto("/account/credits");
  const ledger = page.getByRole("region", { name: "积分明细", exact: true });
  await expect(ledger.locator(".account-toolbar-meta")).toContainText("当前可用 — 积分");
  await expect(ledger.getByText("收支记录暂时不可用", { exact: true })).toBeVisible();
  await expect(ledger.getByText("暂无收支记录", { exact: true })).toHaveCount(0);
  const initialReads = reads;
  await ledger.getByRole("button", { name: "重新加载收支", exact: true }).click();
  await expect.poll(() => reads).toBeGreaterThan(initialReads);
  await page.getByRole("tab", { name: "概览", exact: true }).click();
  await expect(page.locator(".account-balance")).toHaveText("—");
});

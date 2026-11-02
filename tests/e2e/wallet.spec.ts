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
  await page.getByRole("menuitem", { name: "订阅与账单", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "订阅与账单" });
  await expect(panel.getByText("可用积分", { exact: true })).toBeVisible();
  await expect(panel.getByText("每张 2 积分 · 生成失败按张退回", { exact: true })).toBeVisible();
  await expect(panel.getByText(/UID 0123456789/)).toBeVisible();
  await expect(panel.getByRole("heading", { name: "2026年10月21日" })).toBeVisible();
  await panel.screenshot({ path: "/tmp/lycobo-billing-redesign-desktop.png" });
  await panel.getByRole("tab", { name: "充值订单", exact: true }).click();
  await expect(panel.getByText(/已到账/)).toBeVisible();
  await expect(panel.getByText(/¥10.00/)).toBeVisible();
  await expect(panel.getByRole("button", { name: "充值积分", exact: true })).toBeEnabled();
  await expect(panel.getByRole("button", { name: "会员方案", exact: true })).toBeEnabled();
  await page.screenshot({ path: "/tmp/lycobo-account-orders-desktop.png" });
  await page.setViewportSize({ width: 320, height: 760 });
  await expect(panel.getByText(/¥10.00/)).toBeVisible();
  await panel.getByRole("tab", { name: "收支明细", exact: true }).click();
  await panel.screenshot({ path: "/tmp/lycobo-billing-redesign-mobile.png" });
  await expect.poll(() => panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
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
  await page.goto("/create");
  await page.locator(".account-trigger").click();
  await page.getByRole("menuitem", { name: "订阅与账单", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "订阅与账单", exact: true });
  await expect(panel.locator(".billing-balance > strong")).toHaveText("—");
  await expect(panel.getByText("收支记录暂时不可用", { exact: true })).toBeVisible();
  await expect(panel.getByText("暂无收支记录", { exact: true })).toHaveCount(0);
  const initialReads = reads;
  await panel.getByRole("button", { name: "重新加载收支", exact: true }).click();
  await expect.poll(() => reads).toBeGreaterThan(initialReads);
});

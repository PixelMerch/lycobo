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
  await expect(page.locator(".account-trigger")).toContainText("200");
  await page.locator(".account-trigger").click();
  await page.getByRole("menuitem", { name: "订阅与账单", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "订阅与账单" });
  await expect(panel.getByText("企业金币余额", { exact: true })).toBeVisible();
  await expect(panel.getByText("每张 2 币", { exact: true })).toBeVisible();
  await expect(panel.getByText(/用户 0123456789/)).toBeVisible();
  await panel.getByRole("tab", { name: "充值订单", exact: true }).click();
  await expect(panel.getByText(/已到账/)).toBeVisible();
  await expect(panel.getByText(/¥10.00/)).toBeVisible();
  await expect(panel.getByRole("button", { name: "充值积分", exact: true })).toBeDisabled();
  await expect(panel.getByRole("button", { name: "订阅会员", exact: true })).toBeDisabled();
  await page.screenshot({ path: "/tmp/lycobo-account-orders-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
});

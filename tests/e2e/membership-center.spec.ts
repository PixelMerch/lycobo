import { expect, type Page, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

async function signIn(page: Page) {
  await mockImageApi(page);
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: apiFixture({
        userId: crypto.randomUUID(),
        organizationId: crypto.randomUUID(),
        account: "membership-fixture",
        role: "admin",
      }),
    }),
  );
}

for (const width of [1440, 320]) {
  test(`separate recharge and membership preserve drafts and never purchase at ${width}px`, async ({
    page,
  }) => {
    await signIn(page);
    const writes: string[] = [];
    let ledgerReads = 0;
    page.on("request", (request) => {
      if (request.method() !== "GET" && !request.url().endsWith("/api/v1/image-session"))
        writes.push(request.url());
      if (request.url().includes("/api/v1/wallet/entries")) ledgerReads++;
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/create");
    const draft = page.getByLabel("提示词", { exact: true });
    await draft.fill("保留创作草稿，不创建付费任务");
    const header = page.locator(".topbar");
    const balance = header.getByRole("button", { name: "积分 200，充值积分" });
    await expect(balance).toBeVisible();
    await balance.click();
    const recharge = page.getByRole("dialog", { name: "积分充值", exact: true });
    await expect(recharge).toBeVisible();
    await expect(recharge.getByRole("tab")).toHaveCount(0);
    const pack = recharge.getByRole("radio", { name: "3,000 积分，示例价格 300 元", exact: true });
    await pack.click();
    await expect(pack).toBeChecked();
    await expect(recharge.getByRole("button", { name: "充值即将开放" })).toBeDisabled();
    expect(ledgerReads).toBe(0);
    await recharge.screenshot({ path: `/tmp/lycobo-redesign-recharge-${width}.png` });
    await expect(recharge.getByText("企业共享账户", { exact: true })).toHaveCount(0);
    await expect(recharge.getByRole("button", { name: "积分明细", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(balance).toBeFocused();
    await expect(draft).toHaveValue("保留创作草稿，不创建付费任务");
    await header.getByRole("button", { name: "开通会员", exact: true }).click();
    await expect(page).toHaveURL(/\/membership$/);
    await expect(page.getByRole("heading", { name: /让好商品，\s*拥有好表达。/ })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "创作会员即将开放" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "专业会员即将开放" })).toBeDisabled();
    await page.getByRole("radio", { name: "年度", exact: true }).click();
    await expect(page.getByText("/ 年", { exact: true })).toHaveCount(2);
    await page.locator(".membership-page").evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.screenshot({ path: `/tmp/lycobo-redesign-membership-${width}.png` });
    await page.getByRole("button", { name: "返回创作", exact: true }).click();
    await expect(page).toHaveURL(/\/create$/);
    await expect(draft).toHaveValue("保留创作草稿，不创建付费任务");
    await expect(page.getByRole("button", { name: "生成商品主图", exact: true })).toBeEnabled();
    expect(writes).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("credit hover preview shares reads, supports keyboard and leaves recharge as primary press", async ({
  page,
}) => {
  await signIn(page);
  let ledgerResponses = 0;
  page.on("response", (response) => {
    if (response.ok() && response.url().includes("/api/v1/wallet/entries")) ledgerResponses++;
  });
  await page.goto("/create");
  const balance = page.locator(".topbar .header-balance");
  await balance.hover();
  const preview = page.getByRole("dialog", { name: "积分概览" });
  await expect(preview.getByText("暂无积分记录", { exact: true })).toBeVisible();
  await preview.getByRole("button", { name: "查看积分明细" }).hover();
  await expect(preview).toBeVisible();
  await expect(preview).toHaveCSS("outline-style", "none");
  expect(await balance.evaluate((el) => el.closest("[inert]") === null)).toBe(true);
  await preview.screenshot({ path: "/tmp/lycobo-redesign-credit-preview.png" });
  await preview.getByRole("button", { name: "查看积分明细" }).click();
  const billing = page.getByRole("dialog", { name: "订阅与账单", exact: true });
  await expect(billing.getByText("暂无收支记录", { exact: true })).toBeVisible();
  expect(ledgerResponses).toBe(1);
  await page.keyboard.press("Escape");
  await page.mouse.move(500, 500);
  await balance.focus();
  await page.keyboard.press("ArrowDown");
  await expect(preview.getByRole("button", { name: "充值积分", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(balance).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "积分充值", exact: true })).toBeVisible();
  await expect(preview).toHaveCount(0);
});

test("unavailable balance stays unknown in recharge instead of becoming zero", async ({ page }) => {
  await signIn(page);
  await page.route("**/api/v1/wallet", (route) =>
    route.fulfill({ status: 503, json: apiFixture({}, 503) }),
  );
  await page.goto("/");
  const balance = page.locator(".topbar").getByRole("button", { name: "积分 —，充值积分" });
  await expect(balance).toBeVisible();
  await balance.click();
  const dialog = page.getByRole("dialog", { name: "积分充值", exact: true });
  await expect(dialog.getByRole("radio")).toHaveCount(9);
  await expect(dialog.locator(".credit-recharge-balance")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(balance).toBeFocused();
});

test("signed-out header keeps login without inventing benefits", async ({ page }) => {
  await mockImageApi(page);
  await page.goto("/");
  await expect(
    page.locator(".topbar").getByRole("button", { name: "登录领积分", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".header-benefits")).toHaveCount(0);
});

test("credit preview shows only three real entries and reopens from cache", async ({ page }) => {
  await signIn(page);
  const kinds = ["recharge", "consume", "refund", "opening"] as const;
  const entries = kinds.map((kind, index) => ({
    id: String(4 - index),
    user_uid: "0123456789",
    kind,
    amount: index === 1 ? -2 : 2,
    balance_after: 200,
    job_id: null,
    task_id: null,
    item_id: null,
    recharge_id: null,
    created_at: "2026-11-02T00:00:00Z",
  }));
  let reads = 0;
  let orders = 0;
  await page.route("**/api/v1/wallet/entries?*", (route) => {
    reads++;
    return route.fulfill({ json: apiFixture({ data: entries }) });
  });
  await page.route("**/api/v1/wallet/recharges?*", (route) => {
    orders++;
    return route.fulfill({ json: apiFixture({ data: [] }) });
  });
  await page.goto("/create");
  const balance = page.locator(".topbar .header-balance");
  await expect(balance).toContainText("200");
  expect(reads).toBe(0);
  await balance.hover();
  const preview = page.getByRole("dialog", { name: "积分概览" });
  await expect(preview.getByRole("listitem")).toHaveCount(3);
  await expect(preview.getByText("充值到账", { exact: true })).toBeVisible();
  await expect(preview.getByText("图片生成", { exact: true })).toBeVisible();
  await expect(preview.getByText("生成失败退款", { exact: true })).toBeVisible();
  await expect(preview.getByText("期初余额", { exact: true })).toHaveCount(0);
  // StrictMode may cancel the first development request before restarting it.
  // Cache reuse must add no request after the initial successful load.
  expect(reads).toBeGreaterThan(0);
  const initialReads = reads;
  expect(orders).toBe(0);
  await page.mouse.move(500, 500);
  await expect(preview).toHaveCount(0);
  await balance.hover();
  await expect(preview.getByRole("listitem")).toHaveCount(3);
  expect(reads).toBe(initialReads);
  await balance.click();
  await expect(page.getByRole("dialog", { name: "积分充值", exact: true })).toBeVisible();
  await expect(preview).toHaveCount(0);
  expect(orders).toBe(0);
});

test("direct membership visits have a safe return to the workspace", async ({ page }) => {
  await signIn(page);
  await page.goto("/membership");
  await page.getByRole("button", { name: "返回创作", exact: true }).click();
  await expect(page).toHaveURL(/\/create$/);
});

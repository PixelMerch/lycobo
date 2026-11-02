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
    const balance = header.getByRole("button", { name: "积分 200，查看积分概览" });
    await expect(balance).toBeVisible();
    await balance.click();
    await page
      .getByRole("dialog", { name: "积分概览" })
      .getByRole("button", { name: "充值积分", exact: true })
      .click();
    const recharge = page.getByRole("dialog", { name: "积分充值", exact: true });
    await expect(recharge).toBeVisible();
    await expect(recharge.getByRole("tab")).toHaveCount(0);
    const pack = recharge.getByRole("radio", { name: "3,000 积分，示例价格 300 元", exact: true });
    await pack.click();
    await expect(pack).toBeChecked();
    await expect(recharge.getByRole("button", { name: "立即购买" })).toBeDisabled();
    expect(ledgerReads).toBeGreaterThan(0);
    await recharge.screenshot({ path: `/tmp/lycobo-redesign-recharge-${width}.png` });
    await expect(recharge.getByText("企业共享账户", { exact: true })).toHaveCount(0);
    await expect(recharge.getByRole("button", { name: "积分明细", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(balance).toBeFocused();
    await expect(draft).toHaveValue("保留创作草稿，不创建付费任务");
    await header.getByRole("button", { name: "开通会员", exact: true }).click();
    await expect(page).toHaveURL(/\/create$/);
    const membership = page.getByRole("dialog", { name: "会员订阅", exact: true });
    await expect(membership).toBeVisible();
    await expect(membership).toHaveCSS("width", `${width}px`);
    await expect(membership).toHaveCSS("height", "900px");
    await expect(membership.getByText("返回创作", { exact: true })).toHaveCount(0);
    await expect(membership.getByText("积分明细", { exact: true })).toHaveCount(0);
    await expect(membership.getByText(/即将开放|方案预览|待确认|待公布/)).toHaveCount(0);
    await expect(membership.getByRole("button", { name: "订阅BASE" })).toBeDisabled();
    await expect(membership.getByRole("button", { name: "订阅APEX" })).toBeDisabled();
    await membership.getByRole("radio", { name: "季付", exact: true }).click();
    await expect(membership.getByText("/ 季", { exact: true })).toHaveCount(4);
    await membership.getByRole("radio", { name: "年付", exact: true }).click();
    await expect(membership.getByText("/ 年", { exact: true })).toHaveCount(4);
    await expect(membership.getByText("LYCOBO MEMBERSHIP", { exact: true })).toHaveCount(0);
    await expect(membership.locator(".membership-plan")).toHaveCount(4);
    const pro = membership.locator('[data-plan="pro"]');
    await expect(pro.locator(".membership-plan-price strong")).toHaveText("¥8,388");
    await pro.getByRole("radio", { name: "PRO 6050积分/月", exact: true }).click();
    await expect(pro.locator(".membership-plan-price strong")).toHaveText("¥3,899");
    await membership.getByRole("radio", { name: "月付", exact: true }).click();
    await expect(membership.getByRole("radio", { name: "月付", exact: true })).toBeChecked();
    await expect(pro.locator(".membership-plan-price strong")).toHaveText("¥398");
    await expect(membership.locator('[data-plan="base"] .membership-plan-price strong')).toHaveText(
      "¥88",
    );
    await expect(membership).toHaveCSS("outline-style", "none");
    await page.screenshot({ path: `/tmp/lycobo-redesign-membership-${width}.png` });
    await membership.getByRole("button", { name: "关闭会员订阅", exact: true }).click();
    await expect(membership).toHaveCount(0);
    await expect(header.getByRole("button", { name: "开通会员", exact: true })).toBeFocused();
    await expect(draft).toHaveValue("保留创作草稿，不创建付费任务");
    await expect(page.getByRole("button", { name: "生成商品主图", exact: true })).toBeEnabled();
    expect(writes).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("credit preview opens only on press, shares reads and supports keyboard", async ({ page }) => {
  await signIn(page);
  let ledgerResponses = 0;
  page.on("response", (response) => {
    if (response.ok() && response.url().includes("/api/v1/wallet/entries")) ledgerResponses++;
  });
  await page.goto("/create");
  const balance = page.locator(".topbar .header-balance");
  await balance.hover();
  await page.waitForTimeout(350);
  await expect(page.getByRole("dialog", { name: "积分概览" })).toHaveCount(0);
  await balance.click();
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
  await page.keyboard.press("Enter");
  await expect(preview).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(balance).toBeFocused();
  await page.keyboard.press("Space");
  await expect(preview).toBeVisible();
  await page.getByLabel("提示词", { exact: true }).click();
  await expect(preview).toHaveCount(0);
  await balance.click();
  await expect(preview).toBeVisible();
  await preview.getByRole("button", { name: "充值积分", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "积分充值", exact: true })).toBeVisible();
  await expect(preview).toHaveCount(0);
});

test("unavailable balance stays unknown in recharge instead of becoming zero", async ({ page }) => {
  await signIn(page);
  await page.route("**/api/v1/wallet", (route) =>
    route.fulfill({ status: 503, json: apiFixture({}, 503) }),
  );
  await page.goto("/");
  const balance = page.locator(".topbar").getByRole("button", { name: "积分 —，查看积分概览" });
  await expect(balance).toBeVisible();
  await balance.click();
  await page
    .getByRole("dialog", { name: "积分概览" })
    .getByRole("button", { name: "充值积分", exact: true })
    .click();
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
  await page.waitForTimeout(350);
  await expect(page.getByRole("dialog", { name: "积分概览" })).toHaveCount(0);
  await balance.click();
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
  await expect(preview).toBeVisible();
  await balance.click();
  await expect(preview).toHaveCount(0);
  await balance.click();
  await expect(preview.getByRole("listitem")).toHaveCount(3);
  expect(reads).toBe(initialReads);
  await preview.getByRole("button", { name: "充值积分", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "积分充值", exact: true })).toBeVisible();
  await expect(preview).toHaveCount(0);
  expect(orders).toBe(0);
});

test("direct membership visits have a safe return to the workspace", async ({ page }) => {
  await signIn(page);
  await page.goto("/membership");
  await page.getByRole("button", { name: "关闭会员订阅", exact: true }).click();
  await expect(page).toHaveURL(/\/create$/);
});

test("full-screen membership supports audiences, seats, explanations and FAQ without writes", async ({
  page,
}) => {
  await signIn(page);
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && !request.url().endsWith("/api/v1/image-session"))
      writes.push(request.url());
  });
  await page.goto("/create");
  await page.locator(".topbar").getByRole("button", { name: "开通会员", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "会员订阅", exact: true });
  await dialog.getByRole("tab", { name: "团队", exact: true }).hover();
  await expect(dialog.getByRole("tab", { name: "个人", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await dialog.getByRole("tab", { name: "团队", exact: true }).click();
  const lite = dialog.locator('[data-plan="team-lite"]');
  await expect(lite.locator(".membership-plan-price strong")).toHaveText("¥3,828");
  await lite.getByRole("button", { name: "增加TEAM LITE席位", exact: true }).click();
  await expect(lite.locator(".membership-seat-total")).toContainText("3 席位 · 合计 ¥11,484");
  await dialog.getByRole("radio", { name: "月付", exact: true }).click();
  await expect(lite.locator(".membership-plan-price strong")).toHaveText("¥399");
  await lite.getByRole("button", { name: "TEAM LITE积分说明", exact: true }).hover();
  await expect(page.getByRole("tooltip")).toContainText("每席费用");
  await page.mouse.move(0, 0);
  await page.screenshot({ path: "/tmp/lycobo-membership-team.png" });
  await dialog.getByRole("tab", { name: "企业", exact: true }).click();
  await expect(dialog.getByRole("heading", { name: "企业协作", exact: true })).toBeVisible();
  await expect(dialog.getByText("账户管理", { exact: true })).toBeVisible();
  const question = dialog.getByRole("button", { name: "生成失败后，积分会退回吗？", exact: true });
  await question.click();
  await expect(question).toHaveAttribute("aria-expanded", "true");
  await expect(dialog.getByText(/多张图片部分失败时，只退回失败部分/)).toBeVisible();
  await page.screenshot({ path: "/tmp/lycobo-membership-faq.png" });
  await question.click();
  await expect(question).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(writes).toEqual([]);
});

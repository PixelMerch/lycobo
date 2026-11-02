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
  test(`membership center previews plans and credit packs without changing access or buying at ${width}px`, async ({
    page,
  }) => {
    await signIn(page);
    const writes: string[] = [];
    let ledgerReads = 0;
    let ledgerResponses = 0;
    page.on("response", (response) => {
      if (response.ok() && response.url().includes("/api/v1/wallet/entries")) ledgerResponses++;
    });
    page.on("request", (request) => {
      if (request.method() !== "GET" && !request.url().endsWith("/api/v1/image-session"))
        writes.push(request.url());
      if (request.url().includes("/api/v1/wallet/entries")) ledgerReads++;
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/create");
    const draft = page.getByLabel("提示词", { exact: true });
    await draft.fill("保留创作草稿，不创建付费任务");
    await expect(page.getByRole("button", { name: "生成商品主图", exact: true })).toBeEnabled();
    const header = page.locator(".topbar");
    await expect(
      header.getByRole("button", { name: "企业共享积分 200，查看账单明细" }),
    ).toBeVisible();
    const membership = header.getByRole("button", { name: "会员中心", exact: true });
    await page
      .locator(".topbar")
      .screenshot({ path: `/tmp/lycobo-membership-header-${width}.png` });
    await membership.click();
    const dialog = page.getByRole("dialog", { name: "订阅与账单", exact: true });
    await expect(dialog.getByRole("tab", { name: "会员方案", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(dialog.getByText("创作会员", { exact: true })).toBeVisible();
    await expect(dialog.getByText("专业会员", { exact: true })).toBeAttached();
    await expect(
      dialog.getByRole("button", { name: "创作会员即将开放", exact: true }),
    ).toBeDisabled();
    await expect(
      dialog.getByRole("button", { name: "专业会员即将开放", exact: true }),
    ).toBeDisabled();
    await expect(dialog.getByText("价格待公布", { exact: true })).toHaveCount(2);
    expect(ledgerReads).toBe(0);
    await dialog.getByText("年度", { exact: true }).click();
    await expect(dialog.getByText("按年订阅", { exact: true })).toHaveCount(2);
    await dialog.getByRole("tabpanel", { name: "会员方案", exact: true }).evaluate((panel) => {
      panel.scrollTop = 0;
    });
    await dialog.screenshot({ path: `/tmp/lycobo-membership-${width}.png` });
    await dialog.getByRole("tab", { name: "积分充值", exact: true }).click();
    await dialog.getByText("高频创作", { exact: true }).click();
    await expect(dialog.locator(".credit-pack-checkout strong")).toHaveText("高频创作");
    await expect(dialog.getByRole("button", { name: "充值即将开放", exact: true })).toBeDisabled();
    await expect(
      dialog.getByText("积分包独立购买，用于生成消耗；购买积分不会改变会员等级。", { exact: true }),
    ).toBeVisible();
    expect(ledgerReads).toBe(0);
    await expect(dialog.getByRole("heading", { name: "订阅与账单", exact: true })).toBeInViewport({
      ratio: 1,
    });
    await dialog.screenshot({ path: `/tmp/lycobo-credit-packs-${width}.png` });
    await dialog.getByRole("tab", { name: "账单明细", exact: true }).click();
    await expect(dialog.getByText("暂无收支记录", { exact: true })).toBeVisible();
    // StrictMode can cancel an initial development fetch; count completed reads.
    expect(ledgerResponses).toBe(1);
    await expect(dialog.getByRole("heading", { name: "订阅与账单", exact: true })).toBeInViewport({
      ratio: 1,
    });
    await expect(dialog.getByRole("tab", { name: "会员方案", exact: true })).toBeInViewport({
      ratio: 1,
    });
    await dialog.getByRole("button", { name: "会员方案", exact: true }).click();
    await expect(dialog.getByRole("tab", { name: "会员方案", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const close = dialog.getByRole("button", { name: "关闭订阅与账单", exact: true });
    await close.hover();
    await expect(close).toHaveCSS("outline-style", "none");
    await close.click();
    await expect(dialog).toHaveCount(0);
    await expect(membership).toBeFocused();
    await expect(draft).toHaveValue("保留创作草稿，不创建付费任务");
    expect(writes).toEqual([]);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  });
}

test("header balance opens real billing and unavailable data never becomes a zero balance", async ({
  page,
}) => {
  await signIn(page);
  await page.route("**/api/v1/wallet", (route) =>
    route.fulfill({ status: 503, json: apiFixture({}, 503) }),
  );
  await page.goto("/");
  const balance = page
    .locator(".topbar")
    .getByRole("button", { name: "企业共享积分 —，查看账单明细" });
  await expect(balance).toBeVisible();
  await balance.click();
  const dialog = page.getByRole("dialog", { name: "订阅与账单", exact: true });
  await expect(dialog.getByRole("tab", { name: "账单明细", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(dialog.locator(".account-wallet-heading strong")).toHaveText("—");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(balance).toBeFocused();
  await balance.focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
});

test("signed-out header keeps login and does not invent a wallet or membership", async ({
  page,
}) => {
  await mockImageApi(page);
  await page.goto("/");
  await expect(
    page.locator(".topbar").getByRole("button", { name: "登录领积分", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".header-benefits")).toHaveCount(0);
});

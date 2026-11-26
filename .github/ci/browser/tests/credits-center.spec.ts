import { expect, type Page, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

async function signIn(page: Page) {
  await mockImageApi(page);
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: apiFixture({
        userId: crypto.randomUUID(),
        organizationId: crypto.randomUUID(),
        account: "credits-fixture",
        role: "admin",
      }),
    }),
  );
}

for (const width of [1440, 320]) {
  test(`top-up shows five packs and keeps drafts at ${width}px`, async ({ page }) => {
    await signIn(page);
    const writes: string[] = [];
    let ledgerReads = 0;
    page.on("request", (request) => {
      if (request.method() !== "GET" && !request.url().endsWith("/api/v1/image-session"))
        writes.push(request.url());
      if (request.url().includes("/api/v1/wallet/history")) ledgerReads++;
    });
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(new Date("2026-11-25T12:00:00Z"));
    await page.goto("/zh-CN/dashboard/commerce/create");
    const draft = page.getByLabel("提示词", { exact: true });
    await draft.fill("打开充值前的草稿");
    const purchase = page.getByRole("button", { name: "特惠充值", exact: true });
    await purchase.click();
    const recharge = page.getByRole("dialog", { name: "充值积分", exact: true });
    await expect(recharge).toBeVisible();
    const size = await recharge.evaluate((element) => ({
      width: element.clientWidth,
      height: element.clientHeight,
    }));
    expect(size.width).toBe(width);
    expect(size.height).toBe(900);
    await expect(recharge.getByRole("tab")).toHaveCount(0);
    await expect(recharge.getByRole("listitem")).toHaveCount(5);
    await expect(recharge.getByRole("timer")).toBeVisible();
    await expect(recharge.getByText("$39.99 USD", { exact: true })).toBeVisible();
    const entry = recharge.getByRole("listitem").filter({ hasText: "$2.99 USD" });
    await expect(entry).toContainText("约 52 张图片");
    await expect(entry).toContainText("赠 2 积分");
    await expect(entry.getByRole("button", { name: "购买 102 积分" })).toBeDisabled();
    if (width === 1440) {
      await entry.hover();
      await expect
        .poll(() =>
          entry
            .locator(".credit-pack-surface")
            .evaluate((element) => getComputedStyle(element, "::after").opacity),
        )
        .toBe("1");
    }
    await expect(recharge.getByText("在线支付暂未开放。")).toHaveCount(0);
    expect(ledgerReads).toBe(0);
    await page.keyboard.press("Escape");
    await expect(recharge).toHaveCount(0);
    await expect(purchase).toBeFocused();
    await expect(draft).toHaveValue("打开充值前的草稿");
    expect(writes).toEqual([]);
  });
}

test("credits menu opens on hover without taking focus and works from the keyboard", async ({
  page,
}) => {
  await signIn(page);
  let ledgerReads = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/wallet/history")) ledgerReads++;
  });
  await page.goto("/zh-CN/dashboard/commerce/create");
  const draft = page.getByLabel("提示词", { exact: true });
  await draft.click();
  const credits = page.locator(".workspace-site-header").getByRole("button", { name: "积分 200" });
  const balance = credits.locator(".header-credits-value");
  await expect(balance).toHaveCSS("color", "rgb(255, 255, 255)");
  // 按 vidmuse：悬停展开积分菜单，不抢走正在输入的焦点，也不读取流水。
  await credits.hover();
  // 菜单由触发按钮命名（React Aria 的 aria-labelledby）。
  const menu = page.getByRole("menu", { name: "积分 200", exact: true });
  await expect(menu).toBeVisible();
  await expect(balance).toHaveCSS("color", "rgba(255, 255, 255, 0.8)");
  await expect(credits).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(draft).toBeFocused();
  await expect(menu.getByRole("menuitem")).toHaveText(["充值积分", "积分明细"]);
  await expect(menu.getByText("积分余额", { exact: true })).toBeVisible();
  await expect(page.locator(".credits-menu-balance strong")).toHaveText("200");
  await expect(credits).toHaveCSS("outline-style", "none");
  expect(ledgerReads).toBe(0);
  await page.mouse.move(400, 600);
  await expect(menu).toHaveCount(0);

  // 键盘：Enter 打开后焦点进入第一项，上下键移动，Enter 打开积分明细。
  await credits.focus();
  await page.keyboard.press("Enter");
  await expect(menu.getByRole("menuitem", { name: "充值积分", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "积分明细", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  const usage = page.getByRole("dialog", { name: "积分明细", exact: true });
  await expect(usage).toBeVisible();
  await expect(usage.getByText("最近半年暂无消耗记录", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/commerce\/create$/);
  await page.keyboard.press("Escape");
  await expect(usage).toHaveCount(0);
  await expect(credits).toBeFocused();

  // 充值关闭后焦点回到积分胶囊。
  await credits.click();
  await menu.getByRole("menuitem", { name: "充值积分", exact: true }).click();
  const recharge = page.getByRole("dialog", { name: "充值积分", exact: true });
  await expect(recharge).toBeVisible();
  await recharge.getByRole("button", { name: "关闭充值积分", exact: true }).click();
  await expect(credits).toBeFocused();
});

test("an unavailable balance does not hide credit packs", async ({ page }) => {
  await signIn(page);
  await page.route("**/api/v1/wallet", (route) =>
    route.fulfill({ status: 503, json: apiFixture({}, 503) }),
  );
  await page.goto("/");
  const credits = page.locator(".topbar").getByRole("button", { name: "积分 —" });
  await expect(credits).toBeVisible();
  await credits.hover();
  await expect(page.locator(".credits-menu-balance strong")).toHaveText("—");
  await page.mouse.move(400, 600);
  await credits.click();
  await page.getByRole("menuitem", { name: "充值积分", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "充值积分", exact: true });
  await expect(dialog.getByRole("listitem")).toHaveCount(5);
  await expect(dialog.getByRole("button", { name: "购买 102 积分" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(credits).toBeFocused();
});

test("signed-out header opens login and hides the credit top-up", async ({ page }) => {
  await mockImageApi(page, { signedIn: false });
  await page.goto("/zh-CN");
  const header = page.locator(".topbar");
  const start = header.getByRole("link", { name: "开始创作", exact: true });
  await expect(start).toBeVisible();
  await expect(header.locator(".header-credits, .header-credit-purchase")).toHaveCount(0);
  await start.click();
  await expect(page.locator(".login-page")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("returnTo")).toMatch(/^\/zh-CN\/dashboard(?:\/|$)/);
});

function ledgerEntry(
  id: number,
  kind: string,
  amount: number,
  extra: Record<string, unknown> = {},
) {
  return {
    id: String(id),
    user_uid: "0123456789",
    kind,
    amount,
    job_id: null,
    task_id: null,
    item_id: null,
    recharge_id: null,
    created_at: new Date(Date.UTC(2026, 10, 5, 10, 0) - (1000 - id) * 60000).toISOString(),
    ...extra,
  };
}

test("credit usage scrolls by category at a fixed height with expandable details", async ({
  page,
}) => {
  await signIn(page);
  const spent = Array.from({ length: 23 }, (_, index) =>
    ledgerEntry(500 - index, "consume", -8, {
      job_id: crypto.randomUUID(),
      item_id: crypto.randomUUID(),
      task_id: `W2611${1000 + index}`,
    }),
  );
  const entries = [
    ...spent,
    ledgerEntry(400, "refund", 8, { job_id: crypto.randomUUID(), task_id: "W26110999" }),
    ledgerEntry(399, "recharge", 1000, { recharge_id: "3f8a2c10-0000-4000-8000-000000000000" }),
  ];
  const requests: string[] = [];
  await page.route("**/api/v1/wallet/history?*", (route) => {
    const url = new URL(route.request().url());
    requests.push(url.search);
    const before = url.searchParams.get("before");
    const spentView = url.searchParams.get("view") === "spent";
    const data = entries.filter((entry) => (entry.kind === "consume") === spentView);
    const batch = data.filter((entry) => !before || Number(entry.id) < Number(before));
    return route.fulfill({
      json: apiFixture({
        data: batch.slice(0, 20),
        nextCursor: batch.length > 20 ? (batch[19]?.id ?? null) : null,
      }),
    });
  });
  await page.goto("/zh-CN/dashboard/commerce/create");
  const credits = page.locator(".workspace-site-header").getByRole("button", { name: "积分 200" });
  await credits.click();
  await page.getByRole("menuitem", { name: "积分明细", exact: true }).click();
  const usage = page.getByRole("dialog", { name: "积分明细", exact: true });
  const rows = usage.locator(".credit-usage-row");
  const list = usage.locator(".credit-usage-list");
  await expect(rows).toHaveCount(20);
  await expect(rows.first()).toContainText("图片生成");
  await expect(rows.first()).toContainText("- 8");
  const height = await usage.evaluate((element) => element.clientHeight);
  await list.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(rows).toHaveCount(23);
  await expect(usage.getByRole("navigation", { name: "积分明细分页" })).toHaveCount(0);

  await usage.getByRole("radio", { name: "获得", exact: true }).click();
  await expect(rows).toHaveCount(2);
  expect(await usage.evaluate((element) => element.clientHeight)).toBe(height);
  expect(await list.evaluate((element) => element.scrollTop)).toBe(0);
  await expect(rows.nth(0)).toContainText("生成失败退款");
  await expect(rows.nth(0)).toContainText("+ 8");
  await expect(rows.nth(1)).toContainText("充值到账");
  await expect(rows.nth(1)).toContainText("+ 1,000");
  const recharge = rows.nth(1).getByRole("button");
  await recharge.click();
  await expect(recharge).toHaveAttribute("aria-expanded", "true");
  const details = rows.nth(1).locator(".credit-usage-detail");
  await expect(details).toHaveText(["说明充值订单 3F8A2C10", /^成员/]);
  await expect(usage).toHaveCSS("outline-style", "none");
  expect(await usage.evaluate((element) => element.clientHeight)).toBe(height);
  expect([...new Set(requests)]).toEqual([
    "?limit=20&view=spent",
    "?limit=20&view=spent&before=481",
    "?limit=20&view=earned",
  ]);
  await usage.getByRole("button", { name: "关闭积分明细", exact: true }).click();
  await expect(credits).toBeFocused();
});

test("credit usage keeps loaded rows when loading more fails and retries the cursor", async ({
  page,
}) => {
  await signIn(page);
  const first = Array.from({ length: 20 }, (_, index) => ledgerEntry(900 - index, "consume", -2));
  let failed = false;
  await page.route("**/api/v1/wallet/history?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (!params.has("before"))
      return route.fulfill({ json: apiFixture({ data: first, nextCursor: "881" }) });
    expect(params.get("before")).toBe("881");
    if (!failed) {
      failed = true;
      return route.fulfill({ status: 503, json: apiFixture(null, 503) });
    }
    return route.fulfill({
      json: apiFixture({ data: [ledgerEntry(880, "consume", -2)], nextCursor: null }),
    });
  });
  await page.goto("/zh-CN/dashboard/commerce/create");
  await page.locator(".workspace-site-header .header-credits").click();
  await page.getByRole("menuitem", { name: "积分明细", exact: true }).click();
  const usage = page.getByRole("dialog", { name: "积分明细", exact: true });
  const rows = usage.locator(".credit-usage-row");
  await expect(rows).toHaveCount(20);
  await usage.locator(".credit-usage-list").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const retry = usage.getByRole("button", { name: "重新加载", exact: true });
  await expect(retry).toBeVisible();
  await expect(rows).toHaveCount(20);
  await retry.click();
  await expect(rows).toHaveCount(21);
});

for (const path of ["/recharge", "/membership"]) {
  test(`retired credit route ${path} shows page not found`, async ({ page }) => {
    await mockImageApi(page, { signedIn: false });
    await page.goto(`/en${path}`);
    await expect(page.locator(".route-status")).toBeVisible();
    await expect(page.locator(".credit-pack")).toHaveCount(0);
    await expect(page.locator(".login-page")).toHaveCount(0);
  });
}

test("the account menu blocks background wheel scrolling and restores it on close", async ({
  page,
}) => {
  await signIn(page);
  await page.setViewportSize({ width: 1440, height: 700 });
  await page.goto("/commerce/create");
  await page.getByLabel("提示词", { exact: true }).fill("商品创作需求\n".repeat(100));
  const background = page.locator(".composer-scroll");
  await expect
    .poll(() => background.evaluate((el) => el.scrollHeight > el.clientHeight))
    .toBe(true);
  await background.evaluate((el) => {
    el.scrollTop = 80;
  });
  const position = await background.evaluate((el) => el.scrollTop);
  const bounds = await background.boundingBox();
  if (!bounds) throw new Error("Missing composer scroll region");
  // 积分菜单与“电商”一样是悬停菜单，不锁定滚动；账户菜单仍是模态菜单。
  for (const trigger of [page.locator(".topbar .account-trigger")]) {
    await trigger.click();
    const overlay = page.locator(".account-menu");
    await expect(overlay).toBeVisible();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.wheel(0, 350);
    await page.waitForTimeout(250);
    await expect(overlay).toBeVisible();
    expect(await background.evaluate((el) => el.scrollTop)).toBe(position);
    await page.keyboard.press("Escape");
    await expect(overlay).toHaveCount(0);
    expect(await background.evaluate((el) => el.scrollTop)).toBe(position);
  }
  await page.mouse.wheel(0, 350);
  await expect.poll(() => background.evaluate((el) => el.scrollTop)).toBeGreaterThan(position);
});

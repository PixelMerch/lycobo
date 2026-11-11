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
    await page.goto("/commerce/create");
    const draft = page.getByLabel("提示词", { exact: true });
    await draft.fill("保留创作草稿，不创建付费任务");
    const header = page.locator(".topbar");
    const credits = header.getByRole("button", { name: "积分 200，免费版" });
    await expect(credits).toBeVisible();
    // 积分菜单只有升级、余额、开通会员与积分明细；充值从账户菜单进入。
    if (width < 768) await page.getByRole("button", { name: "打开导航", exact: true }).click();
    const account = page.getByRole("button", { name: "账户菜单：membership-fixture", exact: true });
    await account.click();
    await page.getByRole("menuitem", { name: "充值积分", exact: true }).click();
    const recharge = page.getByRole("dialog", { name: "充值积分", exact: true });
    await expect(recharge).toBeVisible();
    await expect(recharge.getByRole("tab")).toHaveCount(0);
    const pack = recharge.getByRole("radio", { name: /^3,000 积分，示例价格 300 元/ });
    await pack.click();
    await expect(pack).toBeChecked();
    // The order preview follows the selection; payment stays unavailable.
    await expect(recharge.locator(".credit-order-rows")).toContainText("3,000");
    await expect(recharge.locator(".credit-order-after strong")).toContainText("3,200");
    await expect(recharge.getByRole("button", { name: "立即购买" })).toBeDisabled();
    // 打开积分菜单与充值都不读取收支流水。
    expect(ledgerReads).toBe(0);
    await recharge.screenshot({ path: `/tmp/lycobo-redesign-recharge-${width}.png` });
    await expect(recharge.getByText("企业共享账户", { exact: true })).toHaveCount(0);
    await expect(recharge.getByRole("button", { name: "积分明细", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(account).toBeFocused();
    if (width < 768) await page.getByRole("button", { name: "关闭导航", exact: true }).click();
    await expect(draft).toHaveValue("保留创作草稿，不创建付费任务");
    await credits.click();
    await page.getByRole("menuitem", { name: "开通会员", exact: true }).click();
    await expect(page).toHaveURL(/\/commerce\/create$/);
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
    // Headline, cycle hint, badge, estimate and ribbon all derive from the same price table.
    await expect(membership.locator(".membership-hero")).toContainText("低至 ¥0.047 / 积分");
    await expect(
      membership.getByRole("radio", { name: "年付", exact: true }),
    ).toHaveAccessibleDescription("最低 3.8 折");
    await expect(pro.locator(".membership-plan-discount")).toHaveText("4.4 折");
    await expect(pro.locator(".membership-plan-estimate")).toContainText("约生成 6,775 张图片");
    await expect(membership.locator(".membership-plan-ribbon")).toHaveText([
      "3 档额度可选",
      "积分单价最低",
    ]);
    await expect(membership.locator('[data-plan="apex"]')).toHaveAttribute("data-ribbon", "best");
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
    await expect(credits).toBeFocused();
    await expect(draft).toHaveValue("保留创作草稿，不创建付费任务");
    await expect(page.getByRole("button", { name: "立即生成", exact: true })).toBeEnabled();
    expect(writes).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("credits menu opens on hover without taking focus and works from the keyboard", async ({
  page,
}) => {
  await signIn(page);
  let ledgerReads = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/wallet/entries")) ledgerReads++;
  });
  await page.goto("/commerce/create");
  const draft = page.getByLabel("提示词", { exact: true });
  await draft.click();
  const credits = page.locator(".topbar").getByRole("button", { name: "积分 200，免费版" });
  // 按 vidmuse：悬停展开积分菜单，不抢走正在输入的焦点，也不读取流水。
  await credits.hover();
  // 菜单由触发按钮命名（React Aria 的 aria-labelledby）。
  const menu = page.getByRole("menu", { name: "积分 200，免费版", exact: true });
  await expect(menu).toBeVisible();
  await expect(draft).toBeFocused();
  await expect(menu.getByRole("menuitem")).toHaveText(["免费版升级", "开通会员", "积分明细"]);
  await expect(menu.getByText("积分余额", { exact: true })).toBeVisible();
  await expect(page.locator(".credits-menu-balance strong")).toHaveText("200");
  await expect(credits).toHaveCSS("outline-style", "none");
  expect(ledgerReads).toBe(0);
  await page.mouse.move(400, 600);
  await expect(menu).toHaveCount(0);

  // 键盘：Enter 打开后焦点进入第一项，上下键移动，Enter 打开积分明细。
  await credits.focus();
  await page.keyboard.press("Enter");
  await expect(menu.getByRole("menuitem", { name: "免费版，升级", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "积分明细", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  const usage = page.getByRole("dialog", { name: "积分明细", exact: true });
  await expect(usage).toBeVisible();
  await expect(usage.getByText("暂无消耗记录", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/commerce\/create$/);
  await page.keyboard.press("Escape");
  await expect(usage).toHaveCount(0);
  await expect(credits).toBeFocused();

  // “升级”与“开通会员”都打开会员订阅，关闭后焦点回到积分胶囊。
  await credits.click();
  await menu.getByRole("menuitem", { name: "免费版，升级", exact: true }).click();
  const membership = page.getByRole("dialog", { name: "会员订阅", exact: true });
  await expect(membership).toBeVisible();
  await membership.getByRole("button", { name: "关闭会员订阅", exact: true }).click();
  await expect(credits).toBeFocused();
});

test("unavailable balance stays unknown in the menu and recharge instead of becoming zero", async ({
  page,
}) => {
  await signIn(page);
  await page.route("**/api/v1/wallet", (route) =>
    route.fulfill({ status: 503, json: apiFixture({}, 503) }),
  );
  await page.goto("/");
  const credits = page.locator(".topbar").getByRole("button", { name: "积分 —，免费版" });
  await expect(credits).toBeVisible();
  await credits.hover();
  await expect(page.locator(".credits-menu-balance strong")).toHaveText("—");
  await page.mouse.move(400, 600);
  const account = page.getByRole("button", { name: "账户菜单：membership-fixture", exact: true });
  await account.click();
  await page.getByRole("menuitem", { name: "充值积分", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "充值积分", exact: true });
  await expect(dialog.getByRole("radio")).toHaveCount(9);
  // An unreadable balance never becomes 0 in the order preview.
  await expect(dialog.locator(".credit-order-after strong")).toHaveText("—");
  await expect(dialog.getByText("余额暂不可用，读取后显示", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(account).toBeFocused();
});

test("signed-out header keeps login without inventing benefits", async ({ page }) => {
  await mockImageApi(page, { signedIn: false });
  await page.goto("/");
  await expect(
    page.locator(".topbar").getByRole("button", { name: "登录领积分", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".header-credits")).toHaveCount(0);
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
    balance_after: 200,
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
  await page.route("**/api/v1/wallet/entries?*", (route) => {
    const url = new URL(route.request().url());
    requests.push(url.search);
    const before = url.searchParams.get("before");
    const spentView = url.searchParams.get("view") === "spent";
    const data = entries.filter((entry) => (entry.kind === "consume") === spentView);
    const batch = data.filter((entry) => !before || Number(entry.id) < Number(before));
    return route.fulfill({ json: apiFixture({ data: batch.slice(0, 20) }) });
  });
  await page.goto("/commerce/create");
  const credits = page.locator(".topbar").getByRole("button", { name: "积分 200，免费版" });
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
  await expect(details).toHaveText(["说明充值订单 3F8A2C10", /^成员/, "变动后结余200"]);
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
  await page.route("**/api/v1/wallet/entries?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (!params.has("before")) return route.fulfill({ json: apiFixture({ data: first }) });
    expect(params.get("before")).toBe("881");
    if (!failed) {
      failed = true;
      return route.fulfill({ status: 503, json: apiFixture(null, 503) });
    }
    return route.fulfill({ json: apiFixture({ data: [ledgerEntry(880, "consume", -2)] }) });
  });
  await page.goto("/commerce/create");
  await page.locator(".topbar .header-credits").click();
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

test("direct membership visits have a safe return to the workspace", async ({ page }) => {
  await signIn(page);
  await page.goto("/membership");
  await page.getByRole("button", { name: "关闭会员订阅", exact: true }).click();
  await expect(page).toHaveURL(/\/commerce\/create$/);
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
  await page.goto("/commerce/create");
  await page.locator(".topbar .header-credits").click();
  await page.getByRole("menuitem", { name: "开通会员", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "会员订阅", exact: true });
  await dialog.getByRole("tab", { name: "团队", exact: true }).hover();
  await expect(dialog.getByRole("tab", { name: "个人", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await dialog.getByRole("tab", { name: "团队", exact: true }).click();
  const lite = dialog.locator('[data-plan="team-lite"]');
  await expect(lite.locator(".membership-plan-price strong")).toHaveText("¥3,828");
  // Team prices carry their own deepest discount and cheapest-credit highlight.
  await expect(
    dialog.getByRole("radio", { name: "年付", exact: true }),
  ).toHaveAccessibleDescription("最低 3.5 折");
  await expect(dialog.locator('[data-plan="team-max"]')).toHaveAttribute("data-ribbon", "best");
  await expect(dialog.locator(".membership-plan-ribbon")).toHaveText(["积分单价最低"]);
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
  // The chevron follows the open state and the question row keeps no hover fill.
  const chevron = question.locator('[data-slot="accordion-indicator"]');
  await expect(chevron).toHaveAttribute("data-expanded", "true");
  await question.hover();
  await expect(question).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(dialog.getByText(/多张图片部分失败时，只退回失败部分/)).toBeVisible();
  await page.screenshot({ path: "/tmp/lycobo-membership-faq.png" });
  await question.click();
  await expect(question).toHaveAttribute("aria-expanded", "false");
  await expect(chevron).not.toHaveAttribute("data-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(writes).toEqual([]);
});

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

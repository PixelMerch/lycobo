import { expect, test } from "@playwright/test";
import { apiFixture, mockImageEvents } from "./image-api-fixture";

function jobFixture() {
  return {
    id: crypto.randomUUID(),
    public_id: "W12345678",
    organization_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    model: "gpt-image-2",
    prompt: "实时任务",
    resolution: "1K",
    aspect_ratio: "1:1",
    requested_count: 1,
    status: "running",
    created_at: new Date().toISOString(),
    completed_at: null,
    items: [
      {
        id: crypto.randomUUID(),
        position: 0,
        status: "running",
        output_asset_id: null,
        error_code: null,
        width: null,
        height: null,
        worker_id: "fixture",
      },
    ],
  };
}

test("one live connection replaces history polling and updates the task by detail", async ({
  page,
}) => {
  await mockImageEvents(page);
  const job = jobFixture();
  let historyReads = 0,
    details = 0;
  await page.route("**/api/v1/image-tasks*", (route) => {
    historyReads++;
    return route.fulfill({ json: apiFixture({ data: [job] }) });
  });
  await page.route(`**/api/v1/image-tasks/${job.id}`, (route) => {
    details++;
    return route.fulfill({ json: apiFixture(job) });
  });
  await page.goto("/commerce/create");
  await expect(page.locator(".generation-job")).toContainText(job.prompt);
  await expect(page.locator("html")).toHaveAttribute("data-ws-active", "1");
  await expect.poll(() => historyReads).toBeGreaterThan(0);
  // Wait past batching and two former 3-second polling intervals.
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const baseline = historyReads;
  await new Promise((resolve) => setTimeout(resolve, 6500));
  expect(historyReads).toBe(baseline);
  job.status = "failed";
  for (const item of job.items) item.status = "failed";
  await page.evaluate(
    (id) =>
      window.dispatchEvent(
        new CustomEvent("fixture:realtime", {
          detail: {
            type: "image.updated",
            id: "1",
            data: { id: "1", kind: "task", resourceId: id },
          },
        }),
      ),
    job.id,
  );
  await expect(page.locator(".history-failure-thumbnail")).toBeVisible();
  expect(details).toBe(1);
  expect(historyReads).toBe(baseline);
  await page.evaluate(
    (id) =>
      window.dispatchEvent(
        new CustomEvent("fixture:realtime", {
          detail: {
            type: "image.updated",
            id: "1",
            data: { id: "1", kind: "task", resourceId: id },
          },
        }),
      ),
    job.id,
  );
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(details).toBe(1);
});

test("reconnect uses the last cursor, calibrates missed state and keeps a single stream", async ({
  page,
}) => {
  await mockImageEvents(page);
  const job = jobFixture();
  await page.route("**/api/v1/image-tasks*", (route) =>
    route.fulfill({ json: apiFixture({ data: [job] }) }),
  );
  await page.route(`**/api/v1/image-tasks/${job.id}`, (route) =>
    route.fulfill({ json: apiFixture(job) }),
  );
  await page.goto("/commerce/create");
  await expect(page.locator("html")).toHaveAttribute("data-ws-active", "1");
  await page.evaluate(
    (id) =>
      window.dispatchEvent(
        new CustomEvent("fixture:realtime", {
          detail: {
            type: "image.updated",
            id: "7",
            data: { id: "7", kind: "task", resourceId: id },
          },
        }),
      ),
    job.id,
  );
  await new Promise((resolve) => setTimeout(resolve, 300));
  job.status = "failed";
  for (const item of job.items) item.status = "failed";
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent("fixture:realtime", { detail: { type: "error" } })),
  );
  await expect(page.locator("html")).toHaveAttribute("data-ws-url", /cursor=7/);
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("fixture:realtime", { detail: { type: "resync", id: "8" } }),
    ),
  );
  await expect(page.locator(".history-failure-thumbnail")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-ws-active", "1");
});

test("logout closes the shared stream and removes prior identity data", async ({ page }) => {
  await mockImageEvents(page);
  const user = {
    userId: crypto.randomUUID(),
    organizationId: crypto.randomUUID(),
    account: "realtime-logout",
    role: "member",
  };
  let loggedIn = true;
  await page.route("**/api/v1/auth/**", (route) => {
    if (route.request().url().endsWith("/logout")) {
      loggedIn = false;
      return route.fulfill({ json: apiFixture({}) });
    }
    return route.fulfill({
      status: loggedIn ? 200 : 401,
      json: apiFixture(loggedIn ? user : {}, loggedIn ? 200 : 401),
    });
  });
  await page.route("**/api/v1/image-session", (route) =>
    route.fulfill({
      status: loggedIn ? 200 : 401,
      json: loggedIn
        ? apiFixture(user)
        : {
            request_id: crypto.randomUUID(),
            code: 40100,
            message: "请先登录",
            data: {},
            error: { code: "UNAUTHORIZED" },
          },
    }),
  );
  await page.goto("/commerce/create");
  await expect(page.locator(".account-trigger")).toHaveAccessibleName(`账户菜单：${user.account}`);
  await expect(page.locator("html")).toHaveAttribute("data-ws-active", "1");
  await page.locator(".account-trigger").click();
  await page.getByRole("menuitem", { name: "退出登录", exact: true }).click();
  // 工作区需要登录：退出后转到独立登录页，私有推送随之关闭。
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await expect(page.locator("html")).toHaveAttribute("data-ws-active", "0");
  // 关闭登录页回到公开首页（不刷新页面），游客改用只含发布消息的公开推送。
  await page.getByRole("button", { name: "关闭登录", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-ws-url", /realtime\/public/);
  await expect(page.locator(".account-trigger")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "登录领积分", exact: true })).toBeVisible();
});

test("only wallet events refresh balance, task states do not duplicate the read", async ({
  page,
}) => {
  await mockImageEvents(page);
  // The signed-in account capsule shows the shared balance, so it observes the wallet.
  await page.route("**/api/v1/auth/session", (route) =>
    route.fulfill({
      json: apiFixture({
        userId: crypto.randomUUID(),
        organizationId: crypto.randomUUID(),
        role: "admin",
        account: "wallet-fixture",
      }),
    }),
  );
  const job = jobFixture();
  let wallets = 0;
  let details = 0;
  await page.route("**/api/v1/wallet", (route) => {
    wallets++;
    return route.fulfill({ json: apiFixture({ balance: 200, unitCredits: 2 }) });
  });
  await page.route("**/api/v1/image-tasks*", (route) =>
    route.fulfill({ json: apiFixture({ data: [job] }) }),
  );
  await page.route(`**/api/v1/image-tasks/${job.id}`, (route) => {
    details++;
    return route.fulfill({ json: apiFixture(job) });
  });
  await page.goto("/commerce/create");
  await expect(page.locator(".generation-job")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-ws-active", "1");
  await page.waitForTimeout(700);
  const baseline = wallets;
  const send = (id: string) =>
    page.evaluate(
      ({ id, resourceId }) =>
        window.dispatchEvent(
          new CustomEvent("fixture:realtime", {
            detail: {
              type: "image.updated",
              id,
              data: { id, kind: "task", resourceId },
            },
          }),
        ),
      { id, resourceId: job.id },
    );
  await send("1");
  await expect.poll(() => details).toBe(1);
  await page.waitForTimeout(800);
  expect(wallets).toBe(baseline);
  job.status = "failed";
  for (const item of job.items) item.status = "failed";
  await send("2");
  await expect.poll(() => details).toBe(2);
  expect(wallets).toBe(baseline);
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("fixture:realtime", {
        detail: { type: "event", cursor: "3", event: { id: crypto.randomUUID(), kind: "wallet" } },
      }),
    ),
  );
  await expect.poll(() => wallets).toBe(baseline + 1);
  await send("4");
  await expect.poll(() => details).toBe(3);
  await page.waitForTimeout(800);
  expect(wallets).toBe(baseline + 1);
});

test("release push preserves the draft and asks the user to refresh", async ({ page }) => {
  await mockImageEvents(page);
  await page.goto("/commerce/create");
  const draft = page.getByLabel(/^(提示词|制作要求)$/, { exact: true });
  await draft.fill("更新提示到来时保留草稿");
  await expect(page.locator("html")).toHaveAttribute("data-ws-active", "1");
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("fixture:realtime", {
        detail: {
          type: "event",
          cursor: "1",
          event: {
            id: crypto.randomUUID(),
            kind: "release",
            release: {
              version: "next-fixture",
              title: "新的功能已上线",
              description: "fixture 发布摘要",
              publishedAt: new Date().toISOString(),
            },
          },
        },
      }),
    ),
  );
  await expect(page.getByText(/网站有新版本可用/)).toBeVisible();
  await expect(draft).toHaveValue("更新提示到来时保留草稿");
  // 新版本只用 Toast 提示，顶部栏不再有更新记录入口，也不会自动刷新。
  await expect(page.getByRole("button", { name: /^更新记录/ })).toHaveCount(0);
  await expect(draft).toHaveValue("更新提示到来时保留草稿");
});

test("notification push updates unread state and persists an explicit read", async ({ page }) => {
  await mockImageEvents(page);
  let visible = false,
    read = false;
  const id = crypto.randomUUID();
  await page.route("**/api/v1/notifications", (route) =>
    route.fulfill({
      json: apiFixture({
        data: visible
          ? [
              {
                id,
                title: "图片生成完成",
                body: "fixture 任务完成",
                createdAt: new Date().toISOString(),
                read,
              },
            ]
          : [],
        unread: visible && !read ? 1 : 0,
        nextCursor: null,
      }),
    }),
  );
  await page.route(`**/api/v1/notifications/${id}/read`, async (route) => {
    read = true;
    await route.fulfill({ json: apiFixture({}) });
    await page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent("fixture:realtime", {
          detail: {
            type: "event",
            cursor: "2",
            event: { id: crypto.randomUUID(), kind: "notification" },
          },
        }),
      ),
    );
  });
  await page.goto("/commerce/create");
  await expect(page.getByRole("button", { name: "消息（0 条未读）", exact: true })).toBeVisible();
  visible = true;
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("fixture:realtime", {
        detail: {
          type: "event",
          cursor: "1",
          event: { id: crypto.randomUUID(), kind: "notification" },
        },
      }),
    ),
  );
  await page.getByRole("button", { name: "消息（1 条未读）", exact: true }).click();
  const panel = page.getByRole("dialog", { name: "消息中心" });
  await expect(panel.getByText("图片生成完成")).toBeVisible();
  await panel.getByRole("button", { name: "标为已读", exact: true }).click();
  await expect(panel.getByText("已读", { exact: true })).toBeVisible();
  expect(read).toBe(true);
});

for (const connected of [true, false]) {
  test(`submission receipt refreshes balance once with push connected=${connected}`, async ({
    page,
  }) => {
    await mockImageEvents(page);
    let wallets = 0,
      assets = 0;
    await page.route("**/api/v1/wallet", (route) => {
      wallets++;
      return route.fulfill({ json: apiFixture({ balance: 200, unitCredits: 2 }) });
    });
    await page.route("**/api/v1/image-assets?**", (route) => {
      assets++;
      return route.fulfill({ json: apiFixture({ data: [] }) });
    });
    await page.route("**/api/v1/image-tasks", async (route) => {
      if (route.request().method() !== "POST")
        return route.fulfill({ json: apiFixture({ data: [] }) });
      await page.evaluate(() =>
        window.dispatchEvent(
          new CustomEvent("fixture:realtime", {
            detail: {
              type: "event",
              cursor: "1",
              event: { id: crypto.randomUUID(), kind: "wallet" },
            },
          }),
        ),
      );
      return route.fulfill({
        status: 202,
        json: apiFixture({ id: crypto.randomUUID(), replayed: false }),
      });
    });
    await page.goto("/commerce/create");
    await expect(page.locator("html")).toHaveAttribute("data-ws-active", "1");
    await expect.poll(() => wallets).toBeGreaterThan(0);
    await page.getByLabel(/^(提示词|制作要求)$/, { exact: true }).fill("fixture 减少重复读取");
    if (!connected)
      await page.evaluate(() =>
        window.dispatchEvent(new CustomEvent("fixture:realtime", { detail: { type: "error" } })),
      );
    const baselineWallets = wallets,
      baselineAssets = assets;
    await page.getByRole("button", { name: "生成商品主图", exact: true }).click();
    await expect.poll(() => wallets).toBe(baselineWallets + 1);
    await page.clock.install();
    await page.clock.fastForward(3000);
    expect(wallets).toBe(baselineWallets + 1);
    expect(assets).toBe(baselineAssets);
  });
}

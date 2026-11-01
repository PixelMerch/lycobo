import { expect, test } from "@playwright/test";
import { apiFixture, mockImageEvents } from "./image-api-fixture";

function jobFixture() {
  return {
    id: crypto.randomUUID(),
    public_id: "W12345678",
    organization_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    model: "gpt-image-2",
    prompt: "SSE 任务",
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
  await page.goto("/create");
  await expect(page.locator(".generation-job")).toContainText(job.prompt);
  await expect(page.locator("html")).toHaveAttribute("data-sse-active", "1");
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
        new CustomEvent("fixture:sse", {
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
        new CustomEvent("fixture:sse", {
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
  await page.goto("/create");
  await expect(page.locator("html")).toHaveAttribute("data-sse-active", "1");
  await page.evaluate(
    (id) =>
      window.dispatchEvent(
        new CustomEvent("fixture:sse", {
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
    window.dispatchEvent(new CustomEvent("fixture:sse", { detail: { type: "error" } })),
  );
  await expect(page.locator("html")).toHaveAttribute("data-sse-url", /cursor=7/);
  await expect(page.locator(".history-failure-thumbnail")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-sse-active", "1");
});

test("short-lived streams keep exponential backoff after ready", async ({ page }) => {
  await mockImageEvents(page);
  let checks = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/image-models") checks++;
  });
  await page.goto("/create");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-sse-active", "1");
  const baseline = checks;
  await page.clock.install();
  const disconnect = () =>
    page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("fixture:sse", { detail: { type: "error" } })),
    );
  await disconnect();
  await expect(html).toHaveAttribute("data-sse-active", "0");
  await page.clock.runFor(1100);
  await expect(html).toHaveAttribute("data-sse-active", "1");
  await disconnect();
  await page.clock.runFor(1100);
  await expect(html).toHaveAttribute("data-sse-active", "0");
  await page.clock.runFor(1100);
  await expect(html).toHaveAttribute("data-sse-active", "1");
  expect(checks).toBe(baseline);
  await disconnect();
  await page.clock.runFor(2100);
  await expect(html).toHaveAttribute("data-sse-active", "0");
  // The third failure in a row re-checks the capability once; events stay offered.
  await expect.poll(() => checks).toBe(baseline + 1);
  await page.clock.runFor(2100);
  await expect(html).toHaveAttribute("data-sse-active", "1");
});

test("a failing stream stops reconnecting once the server no longer offers events", async ({
  page,
}) => {
  let offered = true,
    checks = 0;
  await mockImageEvents(page, () => offered);
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/image-models") checks++;
  });
  await page.goto("/create");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-sse-active", "1");
  const baseline = checks;
  // The server stops offering events while the tab still holds the capability it loaded.
  offered = false;
  const disconnect = () =>
    page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("fixture:sse", { detail: { type: "error" } })),
    );
  // The first two failures reconnect after 1 s and 2 s without asking the server again.
  for (const total of ["2", "3"]) {
    await disconnect();
    await expect(html).toHaveAttribute("data-sse-total", total);
  }
  expect(checks).toBe(baseline);
  await disconnect();
  await expect.poll(() => checks).toBe(baseline + 1);
  // Wait past the 4-second reconnect that would otherwise follow the third failure.
  await page.waitForTimeout(5000);
  await expect(html).toHaveAttribute("data-sse-active", "0");
  await expect(html).toHaveAttribute("data-sse-total", "3");
});

test("unavailable push does not start business polling", async ({ page }) => {
  await mockImageEvents(page, false);
  const job = jobFixture();
  let reads = 0;
  await page.route("**/api/v1/image-tasks*", (route) => {
    reads++;
    return route.fulfill({ json: apiFixture({ data: [job] }) });
  });
  await page.goto("/create");
  await expect(page.locator(".generation-job")).toContainText(job.prompt);
  const baseline = reads;
  await page.clock.install();
  await page.clock.fastForward(65000);
  expect(reads).toBe(baseline);
  await expect(page.locator("html")).not.toHaveAttribute("data-sse-active");
});

test("logout closes the shared stream and removes prior identity data", async ({ page }) => {
  await mockImageEvents(page);
  const user = {
    userId: crypto.randomUUID(),
    organizationId: crypto.randomUUID(),
    account: "sse-logout",
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
  await page.goto("/create");
  await expect(page.locator(".account-trigger")).toHaveAccessibleName(`账户菜单：${user.account}`);
  await expect(page.locator("html")).toHaveAttribute("data-sse-active", "1");
  await page.locator(".account-trigger").click();
  await page.getByRole("menuitem", { name: "退出登录", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-sse-active", "0");
  await expect(page.getByRole("button", { name: "登录领积分", exact: true })).toBeVisible();
});

test("running task events do not refetch wallet but a refund does", async ({ page }) => {
  await mockImageEvents(page);
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
  await page.goto("/create");
  await expect(page.locator(".generation-job")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-sse-active", "1");
  await page.waitForTimeout(700);
  const baseline = wallets;
  const send = (id: string) =>
    page.evaluate(
      ({ id, resourceId }) =>
        window.dispatchEvent(
          new CustomEvent("fixture:sse", {
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
  await expect.poll(() => wallets).toBe(baseline + 1);
  await send("3");
  await expect.poll(() => details).toBe(3);
  await page.waitForTimeout(800);
  expect(wallets).toBe(baseline + 1);
});

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
  await page.goto("/create");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-sse-active", "1");
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
  await disconnect();
  await page.clock.runFor(2100);
  await expect(html).toHaveAttribute("data-sse-active", "0");
  await page.clock.runFor(2100);
  await expect(html).toHaveAttribute("data-sse-active", "1");
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

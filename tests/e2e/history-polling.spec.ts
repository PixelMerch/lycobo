import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

test("idle history is fetched once and does not keep polling", async ({ page }) => {
  await mockImageApi(page);
  let requests = 0;
  await page.route("**/api/v1/image-tasks*", (route) => {
    requests++;
    return route.fulfill({ json: apiFixture({ data: [] }) });
  });
  await page.goto("/commerce/create");
  await expect(page.locator(".history-rail")).toContainText("暂无记录");
  await new Promise((resolve) => setTimeout(resolve, 7000));
  expect(requests).toBe(1);
});

test("active history stays unchanged without push until the user reloads", async ({ page }) => {
  await mockImageApi(page);
  let requests = 0;
  let finished = false;
  const job = {
    id: crypto.randomUUID(),
    organization_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    model: "gpt-image-2",
    prompt: "轮询测试",
    resolution: "1K",
    aspect_ratio: "1:1",
    requested_count: 1,
    created_at: new Date().toISOString(),
    items: [],
  };
  await page.route("**/api/v1/image-tasks*", (route) => {
    requests++;
    return route.fulfill({
      json: apiFixture({
        data: [
          {
            ...job,
            status: finished ? "failed" : "running",
            completed_at: finished ? new Date().toISOString() : null,
          },
        ],
      }),
    });
  });
  await page.goto("/commerce/create");
  await expect(page.locator(".generation-job")).toContainText(job.prompt);
  await page.clock.install();
  await page.clock.fastForward(65000);
  expect(requests).toBe(1);
  finished = true;
  await page.reload();
  await expect(page.locator(".history-failure-thumbnail")).toBeVisible();
  expect(requests).toBe(2);
});

test("idle assets and authentication do not issue periodic requests", async ({ page }) => {
  await mockImageApi(page);
  let assets = 0;
  let sessions = 0;
  await page.route("**/api/v1/image-assets?*", (route) => {
    assets++;
    return route.fulfill({ json: apiFixture({ data: [] }) });
  });
  await page.route("**/api/v1/auth/session", (route) => {
    sessions++;
    return route.fulfill({ status: 401, json: apiFixture({}, 401) });
  });
  await page.goto("/assets");
  await expect.poll(() => assets).toBe(1);
  await expect.poll(() => sessions).toBeGreaterThan(0);
  const baseline = { assets, sessions };
  await page.clock.install();
  await page.clock.fastForward(125000);
  expect({ assets, sessions }).toEqual(baseline);
});

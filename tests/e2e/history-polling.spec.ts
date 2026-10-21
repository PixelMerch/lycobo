import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

test("idle history is fetched once and does not keep polling", async ({ page }) => {
  await mockImageApi(page);
  let requests = 0;
  await page.route("**/api/v1/image-tasks*", (route) => {
    requests++;
    return route.fulfill({ json: apiFixture({ data: [] }) });
  });
  await page.goto("/create");
  await expect(page.locator(".history-rail")).toContainText("暂无记录");
  await new Promise((resolve) => setTimeout(resolve, 7000));
  expect(requests).toBe(1);
});

test("one history poller refreshes active work then stops when the task fails", async ({
  page,
}) => {
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
  await page.goto("/create");
  await expect(page.locator(".generation-job")).toContainText(job.prompt);
  await new Promise((resolve) => setTimeout(resolve, 3100));
  await expect.poll(() => requests).toBe(2);
  finished = true;
  await new Promise((resolve) => setTimeout(resolve, 3100));
  await expect(page.locator(".history-failure-thumbnail")).toBeVisible();
  expect(requests).toBe(3);
  await new Promise((resolve) => setTimeout(resolve, 7000));
  expect(requests).toBe(3);
});

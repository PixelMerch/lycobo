import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

test("hover retries only the chosen image after confirming its own cost", async ({ page }) => {
  await mockImageApi(page);
  const input = {
    model: "gpt-image-2",
    prompt: "单图重试",
    resolution: "1K",
    aspectRatio: "1:1",
    count: 3,
    referenceAssetIds: [],
  };
  const items = ["needs_reconciliation", "failed", "queued"].map((status, position) => ({
    id: crypto.randomUUID(),
    position,
    status,
    output_asset_id: null,
    worker_id: null,
    error_code: null,
    width: null,
    height: null,
  }));
  const job = {
    id: crypto.randomUUID(),
    organization_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    input,
    model: input.model,
    prompt: input.prompt,
    resolution: "1K",
    aspect_ratio: "1:1",
    requested_count: 3,
    unit_credits: 20,
    status: "running",
    created_at: new Date().toISOString(),
    completed_at: null,
    items,
  };
  const submissions: unknown[] = [];
  let loseResponse = true;
  const keys: (string | undefined)[] = [];
  await page.route("**/api/v1/image-tasks**", async (route) => {
    if (route.request().method() === "POST") {
      expect(new URL(route.request().url()).pathname).toBe(`/api/v1/image-tasks/${job.id}/retry`);
      submissions.push(route.request().postDataJSON());
      keys.push(route.request().headers()["idempotency-key"]);
      if (loseResponse) {
        loseResponse = false;
        return route.abort("failed");
      }
      return route.fulfill({ json: apiFixture({ id: job.id, replayed: true }) });
    }
    return route.fulfill({ json: apiFixture({ data: [job] }) });
  });
  await page.goto("/create");
  const card = page.locator(".generation-placeholder").first();
  const action = card.getByRole("button", { name: "重新生成第 1 张", exact: true });
  await expect(card.locator(".generation-retry-overlay")).toHaveCSS("opacity", "0");
  await card.hover();
  await expect(card.locator(".generation-retry-overlay")).toHaveCSS("opacity", "1");
  await expect(action).toBeEnabled();
  await action.click();
  const dialog = page.getByRole("dialog", { name: "重新生成这张图片？", exact: true });
  await expect(dialog).toContainText("本次消耗 2 积分");
  expect(submissions).toHaveLength(0);
  await dialog.getByRole("button", { name: "取消", exact: true }).click();
  expect(submissions).toHaveLength(0);
  await page.mouse.move(0, 0);
  await action.focus();
  await expect(card.locator(".generation-retry-overlay")).toHaveCSS("opacity", "1");
  await action.press("Enter");
  await dialog.getByRole("button", { name: "确认", exact: true }).click();
  await expect(page.getByRole("button", { name: "确认上次提交", exact: true })).toBeEnabled();
  await page.reload();
  await page.getByRole("button", { name: "确认上次提交", exact: true }).click();
  await expect.poll(() => submissions.length).toBe(2);
  expect(submissions).toEqual([{ itemId: items[0]?.id }, { itemId: items[0]?.id }]);
  expect(keys[0]).toBeTruthy();
  expect(keys[1]).toBe(keys[0]);
  expect(items[1]?.status).toBe("failed");
  expect(items[2]?.status).toBe("queued");
});

test("touch users can regenerate a failed image without hovering", async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error("E2E baseURL must be configured.");
  const context = await browser.newContext({
    baseURL,
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  try {
    await mockImageApi(page);
    const job = {
      id: crypto.randomUUID(),
      organization_id: crypto.randomUUID(),
      user_id: crypto.randomUUID(),
      model: "gpt-image-2",
      prompt: "触屏重试",
      resolution: "1K",
      aspect_ratio: "1:1",
      requested_count: 1,
      status: "failed",
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      items: [
        {
          id: crypto.randomUUID(),
          position: 0,
          status: "failed",
          output_asset_id: null,
          error_code: null,
          width: null,
          height: null,
          worker_id: null,
        },
      ],
    };
    await page.route("**/api/v1/image-tasks?*", (route) =>
      route.fulfill({ json: apiFixture({ data: [job] }) }),
    );
    await page.goto("/create");
    await page.getByRole("radio", { name: "历史记录", exact: true }).click();
    const card = page.locator(".generation-placeholder");
    await expect(card.locator(".generation-retry-overlay")).toHaveCSS("opacity", "1");
    const action = card.getByRole("button", { name: "重新生成第 1 张", exact: true });
    await expect(action).toBeVisible();
    await action.tap();
    const dialog = page.getByRole("dialog", { name: "重新生成这张图片？", exact: true });
    await expect(dialog).toContainText("本次消耗 2 积分");
    await dialog.getByRole("button", { name: "取消", exact: true }).tap();
    await expect(dialog).toBeHidden();
  } finally {
    await context.close();
  }
});

test("confirmed legacy textile failure creates a current-channel task for only the chosen view", async ({
  page,
}) => {
  await mockImageApi(page);
  const reference = crypto.randomUUID();
  const job = {
    id: crypto.randomUUID(),
    organization_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    model: "gpt-image-2.5",
    prompt: "旧版家纺裂变",
    resolution: "4K",
    aspect_ratio: "1:1",
    requested_count: 2,
    unit_credits: 20,
    status: "failed",
    created_at: new Date().toISOString(),
    completed_at: null,
    input: {
      model: "gpt-image-2.5",
      prompt: "旧版家纺裂变",
      resolution: "4K",
      aspectRatio: "1:1",
      count: 2,
      referenceAssetIds: [reference],
      textileSet: { version: 3, views: ["front", "fabric"] },
    },
    items: [0, 1].map((position) => ({
      id: crypto.randomUUID(),
      position,
      status: "failed",
      output_asset_id: null,
      error_code: "PROVIDER_HTTP_400",
      width: null,
      height: null,
      worker_id: null,
    })),
  };
  let submitted: unknown;
  await page.route("**/api/v1/image-tasks**", async (route) => {
    if (route.request().method() === "POST") {
      expect(new URL(route.request().url()).pathname).toBe("/api/v1/image-tasks");
      submitted = route.request().postDataJSON();
      return route.fulfill({
        status: 202,
        json: apiFixture({ id: crypto.randomUUID(), replayed: false }, 202),
      });
    }
    return route.fulfill({ json: apiFixture({ data: [job] }) });
  });
  await page.goto("/commerce/textile-set");
  const card = page.locator(".generation-placeholder").first();
  await card.hover();
  await card.getByRole("button", { name: "重新生成第 1 张", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "重新生成这张图片？", exact: true });
  await expect(dialog).toContainText("使用最新裂变配置创建新任务");
  await expect(dialog).toContainText("本次消耗 2 积分");
  expect(submitted).toBeUndefined();
  await dialog.getByRole("button", { name: "确认", exact: true }).click();
  await expect
    .poll(() => submitted)
    .toMatchObject({
      model: "gpt-image-2.5",
      resolution: "4K",
      count: 1,
      referenceAssetIds: [reference],
      textileSet: { version: 5, views: ["front"] },
    });
});

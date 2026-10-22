import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

for (const status of ["failed", "needs_reconciliation", "partially_failed"]) {
  test(`${status}: failure stays informational and confirmed regeneration retries the original task`, async ({
    page,
  }) => {
    await mockImageApi(page);
    const input = {
      model: "gpt-image-2",
      prompt: "失败重试测试",
      resolution: "1K",
      aspectRatio: "1:1",
      count: 1,
      referenceAssetIds: [],
    };
    const job = {
      id: crypto.randomUUID(),
      organization_id: crypto.randomUUID(),
      user_id: crypto.randomUUID(),
      input,
      model: input.model,
      prompt: input.prompt,
      resolution: input.resolution,
      aspect_ratio: input.aspectRatio,
      requested_count: 1,
      status,
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      items: [
        {
          id: crypto.randomUUID(),
          position: 0,
          status: status === "partially_failed" ? "failed" : status,
          output_asset_id: null,
          worker_id: null,
          error_code: "PROVIDER_INVALID_IMAGE_RESPONSE",
          width: null,
          height: null,
        },
      ],
    };
    const submissions: string[] = [];
    await page.route("**/api/v1/image-tasks**", async (route) => {
      if (route.request().method() === "POST") {
        expect(new URL(route.request().url()).pathname).toBe(`/api/v1/image-tasks/${job.id}/retry`);
        expect(route.request().postDataJSON()).toEqual({ ...input, quality: "medium" });
        submissions.push(route.request().headers()["idempotency-key"] ?? "");
        return route.fulfill({
          status: 202,
          json: apiFixture({ id: job.id, replayed: false }),
        });
      }
      return route.fulfill({ json: apiFixture({ data: [job] }) });
    });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/create");
    const preview = page.locator(".generation-placeholder");
    const rail = page.locator(".history-failure-thumbnail");
    const dialog = page.getByRole("dialog", { name: "重新生成这张图片？", exact: true });
    // Failure results and rail thumbnails only report the state; they are not
    // retry entries any more.
    await expect(preview.getByRole("button", { name: "重试", exact: true })).toHaveCount(0);
    await expect(preview.locator(".generation-failure-message")).toBeVisible();
    await expect(rail.locator(".history-failure-label")).toBeVisible();
    await expect(rail.getByRole("button", { name: "重试", exact: true })).toHaveCount(0);
    await rail.click();
    await expect(dialog).toHaveCount(0);
    await expect(rail).toHaveAttribute("aria-current", "true");
    await page
      .locator(".generation-job header")
      .getByRole("button", { name: "重新生成", exact: true })
      .click();
    await expect(dialog).toBeVisible();
    expect(submissions).toHaveLength(0);
    await dialog.getByRole("button", { name: "确认", exact: true }).click();
    await expect.poll(() => submissions.length).toBe(1);
    await expect(page.locator(".generation-job")).toHaveCount(1);
    await page.screenshot({ path: `/tmp/lycobo-failure-retry-${status}.png` });
  });
}

test("partial retry confirms only the cost of failed images", async ({ page }) => {
  await mockImageApi(page);
  const job = {
    id: crypto.randomUUID(),
    organization_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    model: "gpt-image-2",
    prompt: "部分失败费用测试",
    resolution: "1K",
    aspect_ratio: "1:1",
    requested_count: 3,
    status: "partially_failed",
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    input: {
      model: "gpt-image-2",
      prompt: "部分失败费用测试",
      resolution: "1K",
      aspectRatio: "1:1",
      count: 3,
      referenceAssetIds: [],
    },
    items: [0, 1, 2].map((position) => ({
      id: crypto.randomUUID(),
      position,
      status: position === 0 ? "succeeded" : "failed",
      output_asset_id: position === 0 ? crypto.randomUUID() : null,
      worker_id: null,
      error_code: position === 0 ? null : "PROVIDER_INVALID_IMAGE_RESPONSE",
      width: position === 0 ? 1024 : null,
      height: position === 0 ? 1024 : null,
    })),
  };
  await page.route("**/api/v1/image-tasks*", (route) =>
    route.fulfill({ json: apiFixture({ data: [job] }) }),
  );
  await page.route("**/api/v1/image-assets/**/content*", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
    }),
  );
  await page.goto("/create");
  await page.getByRole("button", { name: "重新生成", exact: true }).click();
  await expect(
    page
      .getByRole("dialog", { name: "重新生成这张图片？", exact: true })
      .locator(".confirm-dialog__content"),
  ).toHaveText("本次消耗 40 积分");
});

test("rejected regeneration uses a top toast without inserting an error into history", async ({
  page,
}) => {
  await mockImageApi(page);
  const job = {
    id: crypto.randomUUID(),
    organization_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    public_id: "WEYZHYPZX",
    unit_credits: 1,
    model: "gpt-image-2",
    prompt: "手动重试错误反馈",
    resolution: "1K",
    aspect_ratio: "1:1",
    requested_count: 1,
    status: "needs_reconciliation",
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    input: {
      model: "gpt-image-2",
      prompt: "手动重试错误反馈",
      resolution: "1K",
      aspectRatio: "1:1",
      count: 1,
      referenceAssetIds: [],
    },
    items: [
      {
        id: crypto.randomUUID(),
        position: 0,
        status: "needs_reconciliation",
        output_asset_id: null,
        worker_id: null,
        error_code: "PROVIDER_OUTCOME_UNKNOWN",
        width: null,
        height: null,
      },
    ],
  };
  let retries = 0;
  const message = "企业金币余额不足，每张图片需要 20 币";
  await page.route("**/api/v1/image-tasks**", async (route) => {
    if (route.request().method() === "POST") {
      retries++;
      return route.fulfill({
        status: 409,
        json: {
          request_id: crypto.randomUUID(),
          code: 30003,
          message,
          data: {},
          error: { code: "INSUFFICIENT_CREDITS" },
        },
      });
    }
    return route.fulfill({ json: apiFixture({ data: [job] }) });
  });
  await page.goto("/create");
  await page.getByRole("button", { name: "重新生成", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "重新生成这张图片？", exact: true })).toContainText(
    "本次消耗 1 积分",
  );
  await page
    .getByRole("dialog", { name: "重新生成这张图片？", exact: true })
    .getByRole("button", { name: "确认", exact: true })
    .click();
  await expect.poll(() => retries).toBe(1);
  await expect(page.locator(".toast-region")).toContainText(message);
  await expect(page.locator(".history-action-error")).toHaveCount(0);
  await expect(page.locator(".generation-job")).toHaveCount(1);
});

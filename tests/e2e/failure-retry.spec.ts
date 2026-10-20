import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

for (const status of ["failed", "needs_reconciliation", "partially_failed"]) {
  test(`${status}: failure changes to retry on hover and explicit retries create new tasks`, async ({
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
    await page.route("**/api/v1/image-tasks*", async (route) => {
      if (route.request().method() === "POST") {
        expect(route.request().postDataJSON()).toEqual({ ...input, quality: "medium" });
        submissions.push(route.request().headers()["idempotency-key"] ?? "");
        return route.fulfill({
          status: 202,
          json: apiFixture({ id: crypto.randomUUID(), replayed: false }),
        });
      }
      return route.fulfill({ json: apiFixture({ data: [job] }) });
    });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/create");
    const preview = page.locator(".generation-placeholder");
    const retry = preview.getByRole("button", { name: "重试", exact: true });
    const rail = page.locator(".history-failure-thumbnail");
    await expect(retry.locator(".failure-label")).toBeVisible();
    await expect(retry.locator(".retry-label")).toBeHidden();
    await expect(rail.locator(".failure-label")).toBeVisible();
    await expect(rail.locator(".retry-label")).toBeHidden();
    await preview.hover();
    await expect(retry.locator(".retry-label")).toBeVisible();
    await retry.click();
    const dialog = page.getByRole("dialog", { name: "重新生成这张图片？", exact: true });
    await expect(dialog).toBeVisible();
    expect(submissions).toHaveLength(0);
    await dialog.getByRole("button", { name: "取消", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page
      .locator(".generation-job header")
      .getByRole("button", { name: "重新生成", exact: true })
      .click();
    await dialog.getByRole("button", { name: "确认", exact: true }).click();
    await expect.poll(() => submissions.length).toBe(1);
    await rail.hover();
    await expect(rail.locator(".retry-label")).toBeVisible();
    await rail.getByRole("button", { name: "重试", exact: true }).click();
    await dialog.getByRole("button", { name: "确认", exact: true }).click();
    await expect.poll(() => submissions.length).toBe(2);
    expect(new Set(submissions).size).toBe(2);
    await retry.focus();
    await expect(retry.locator(".retry-label")).toBeVisible();
    await page.screenshot({ path: `/tmp/lycobo-failure-retry-${status}.png` });
  });
}

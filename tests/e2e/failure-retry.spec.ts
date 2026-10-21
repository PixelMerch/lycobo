import { expect, test } from "@playwright/test";
import { apiFixture, mockImageApi } from "./image-api-fixture";

for (const status of ["failed", "needs_reconciliation", "partially_failed"]) {
  test(`${status}: failure stays informational and confirmed regeneration creates a new task`, async ({
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
    await page.screenshot({ path: `/tmp/lycobo-failure-retry-${status}.png` });
  });
}
